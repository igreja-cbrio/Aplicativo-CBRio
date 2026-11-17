// PDF PRIVADO (URL assinada curta do ERP) → arquivo no cache → folha de
// compartilhar ou pasta escolhida. Extraído de `lib/cartaPdf.ts` em 17/11/2026
// para servir também o certificado de Apresentação de Crianças, sem criar um
// segundo jeito de baixar PDF no app.
//
// ⚠️ Só módulos que JÁ estão no binário das lojas (expo-file-system,
// expo-sharing): o OTA não entrega módulo nativo novo.
// ⚠️ O arquivo vai para o CACHE do app, nunca para `documentDirectory`, e a
// limpeza só apaga as pastas do PRÓPRIO prefixo (o teste trava isso).
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { Linking, Platform } from "react-native";

const DIA_MS = 86400000;

/** Pasta de cache deste módulo: `<prefixo>-<timestamp>-<aleatório>`. */
export function pastaDoPrefixo(nome: string, prefixo: string) {
  return new RegExp(`^${prefixo}-[0-9]+-[a-z0-9]+$`).test(nome);
}

// O chooser do Android pode retornar antes de o destinatário ler o anexo.
// Preserve PDFs compartilhados por 24h; limpe apenas o nosso cache, em uso posterior.
export async function limparCacheAntigo(prefixo: string) {
  const root = FileSystem.cacheDirectory;
  if (!root) return;
  const nomes = await FileSystem.readDirectoryAsync(root);
  await Promise.all(
    nomes
      .filter((n) => pastaDoPrefixo(n, prefixo))
      .slice(0, 100)
      .map(async (n) => {
        const info = await FileSystem.getInfoAsync(root + n);
        if (info.exists && info.modificationTime && info.modificationTime * 1000 < Date.now() - DIA_MS)
          await FileSystem.deleteAsync(root + n, { idempotent: true });
      }),
  );
}

/** Nome de arquivo seguro para o sistema de arquivos do aparelho. */
export function nomeDeArquivoSeguro(nome: string, padrao = "documento.pdf") {
  const limpo = String(nome || "").replace(/[\\/:*?"<>|\u0000-\u001f]+/g, " ").replace(/\s+/g, " ").trim();
  const base = limpo || padrao;
  return /\.pdf$/i.test(base) ? base : `${base}.pdf`;
}

type Opcoes = {
  /** Busca a URL assinada (curta) na API do ERP. */
  obterUrl: () => Promise<string>;
  /** Prefixo da pasta no cache (só letras minúsculas). */
  prefixo: string;
  nomeArquivo: string;
  /** Título da folha de compartilhar (Android). */
  titulo: string;
  /** Mensagem quando o download não traz um PDF. */
  erroDownload: string;
};

/** Baixa para o cache. Quem chama decide o que fazer e apaga se não usar. */
async function baixar(o: Opcoes, url: string) {
  await limparCacheAntigo(o.prefixo).catch(() => {});
  const dir = `${FileSystem.cacheDirectory}${o.prefixo}-${Date.now()}-${Math.random().toString(36).slice(2)}/`;
  await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  const tarefa = FileSystem.createDownloadResumable(url, `${dir}${nomeDeArquivoSeguro(o.nomeArquivo)}`);
  let expirou = false;
  const timer = setTimeout(() => {
    expirou = true;
    tarefa.pauseAsync().catch(() => {});
  }, 45000);
  try {
    const r = await tarefa.downloadAsync();
    if (
      expirou ||
      !r ||
      r.status !== 200 ||
      !Object.entries(r.headers || {}).some(
        ([k, v]) => k.toLowerCase() === "content-type" && String(v).includes("application/pdf"),
      )
    )
      throw new Error(o.erroDownload);
    return { dir, uri: r.uri };
  } catch (e) {
    await FileSystem.deleteAsync(dir, { idempotent: true }).catch(() => {});
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

/** Baixa e abre a folha de compartilhar do sistema (WhatsApp, e-mail, Arquivos…). */
export async function compartilharPdfPrivado(o: Opcoes) {
  const url = await o.obterUrl();
  if (Platform.OS === "web") {
    await Linking.openURL(url);
    return;
  }
  if (!FileSystem.cacheDirectory || !(await Sharing.isAvailableAsync()))
    throw new Error("Compartilhamento indisponível neste dispositivo.");
  // Falha no download já apaga a pasta (em `baixar`). Depois que a folha abriu,
  // o arquivo FICA: o Android devolve o controle antes de o destinatário ler.
  const { uri } = await baixar(o, url);
  await Sharing.shareAsync(uri, { mimeType: "application/pdf", UTI: "com.adobe.pdf", dialogTitle: o.titulo });
}

export type ResultadoSalvar = "salvo" | "cancelado" | "folha";

/**
 * "Baixar no celular". Android: a pessoa escolhe a pasta (Downloads, por
 * exemplo) e o PDF é gravado lá pelo StorageAccessFramework. iOS não deixa app
 * gravar fora da própria caixa: o caminho é a folha do sistema, que tem
 * "Salvar em Arquivos".
 */
export async function salvarPdfPrivado(o: Opcoes): Promise<ResultadoSalvar> {
  if (Platform.OS !== "android") {
    await compartilharPdfPrivado(o);
    return Platform.OS === "web" ? "salvo" : "folha";
  }
  const SAF = FileSystem.StorageAccessFramework;
  const permissao = await SAF.requestDirectoryPermissionsAsync();
  if (!permissao.granted) return "cancelado";
  const url = await o.obterUrl();
  const { dir, uri } = await baixar(o, url);
  try {
    const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
    const nome = nomeDeArquivoSeguro(o.nomeArquivo).replace(/\.pdf$/i, "");
    const destino = await SAF.createFileAsync(permissao.directoryUri, nome, "application/pdf");
    await FileSystem.writeAsStringAsync(destino, base64, { encoding: FileSystem.EncodingType.Base64 });
    return "salvo";
  } finally {
    await FileSystem.deleteAsync(dir, { idempotent: true }).catch(() => {});
  }
}
