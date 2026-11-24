// SALVAR FOTOS DO ÁLBUM no aparelho (24/11/2026).
//
// Três estratégias, escolhidas pelo que o BINÁRIO instalado tem:
//
//   a. "galeria" — binário novo, com o módulo nativo `ExpoMediaLibrary`. Pede SÓ
//      a permissão de ADICIONAR fotos e grava direto no rolo da câmera. 2 por vez.
//   b. "pasta"   — Android sem o módulo (binário das lojas de hoje). A pessoa
//      escolhe a pasta UMA vez por lote (StorageAccessFramework) e cada foto é
//      gravada nela. 1 por vez, porque a gravação passa por base64 na memória.
//   c. "folha"   — iPhone sem o módulo. Uma foto de cada vez, pela folha do
//      sistema (Salvar em Arquivos, AirDrop, WhatsApp…). Várias de uma vez não
//      começa: pede para atualizar o app na App Store.
//
// ⚠️⚠️ OTA × módulo nativo: o `require('expo-media-library')` só acontece DENTRO
// da guarda `requireOptionalNativeModule('ExpoMediaLibrary')`. Import no topo
// derrubaria na abertura todo binário publicado que ainda não tem o módulo
// (mesmo padrão de `lib/audioNativo.ts`). `runtimeVersion` continua "1.0.0".
//
// ⚠️ Cada foto: link curto pedido IMEDIATAMENTE antes de baixar (num lote grande,
// link pedido antes vence); 401/403/410 do SharePoint → pede link novo UMA vez;
// status 200 + conteúdo de imagem conferido; arquivo temporário apagado depois
// de salvo, deu certo ou não. Nunca relata sucesso de foto que falhou.
// ⚠️ A URL do SharePoint nunca vai para log nem para mensagem de erro.
import * as FileSystem from "expo-file-system/legacy";
import { Platform, Share } from "react-native";
import { requireOptionalNativeModule } from "expo";
import {
  executarFila,
  FotoCancelada,
  novoCancelamento,
  type Cancelamento,
  type ProgressoFila,
  type ResumoFila,
} from "./filaFotos";
import { linkDeDownloadValido } from "./batismoFotos";

export type FotoParaSalvar = { id: string; nome: string; tamanho: number | null };

export type Plataforma = "ios" | "android" | "outra";
export type Estrategia = "galeria" | "pasta" | "folha" | "atualizar_app" | "indisponivel";

/** Qual caminho usar neste aparelho para `quantidade` fotos. PURO. */
export function escolherEstrategia(p: { plataforma: Plataforma; temGaleria: boolean; quantidade: number }): Estrategia {
  if (p.plataforma === "outra") return "indisponivel";
  if (p.temGaleria) return "galeria";
  if (p.plataforma === "android") return "pasta";
  return p.quantidade <= 1 ? "folha" : "atualizar_app";
}

export const CONCORRENCIA_POR_ESTRATEGIA = { galeria: 2, pasta: 1, folha: 1 } as const;

/** Status do SharePoint que significam "link vencido/recusado": pede um novo, uma vez. */
export const STATUS_RENOVA_LINK: ReadonlySet<number> = new Set([401, 403, 410]);

/** Sem receber byte novo por este tempo, o download é abandonado. */
export const SEM_PROGRESSO_MS = 30_000;
/** Teto absoluto por foto (original de 30 MB numa rede ruim). */
export const TEMPO_MAXIMO_MS = 9 * 60_000;
/** Pasta de cache deste módulo: `<PREFIXO>-<timestamp>-<aleatório>`. */
export const PREFIXO_CACHE = "batismofotos";
const SOBRA_ANTIGA_MS = 60 * 60_000;

export const MENSAGENS = {
  link: "O link da foto não é válido. Tente de novo.",
  download: "A foto não baixou. Verifique a internet e tente de novo.",
  tempo: "A foto demorou demais para baixar. Tente de novo, de preferência no Wi-Fi.",
  formato: "O arquivo recebido não é uma foto. Tente de novo.",
  pasta: "Não foi possível gravar a foto nessa pasta. Tente outra pasta.",
  galeria: "Não foi possível salvar a foto na galeria.",
} as const;

// ── Tipo da imagem ─────────────────────────────────────────────────────────

const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

/** Primeiros bytes de um trecho base64 (sem depender de `atob`). PURO. */
export function bytesDoBase64(s: string, maximo = 16): number[] {
  const out: number[] = [];
  let acc = 0;
  let bits = 0;
  for (const ch of String(s || "")) {
    const v = B64.indexOf(ch);
    if (v < 0) continue;
    acc = ((acc << 6) | v) & 0xffffff;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out.push((acc >> bits) & 0xff);
      if (out.length >= maximo) break;
    }
  }
  return out;
}

export type ExtensaoFoto = "jpg" | "png" | "heic" | "webp" | "gif";

/** Assinatura dos primeiros bytes → tipo da imagem. PURO. */
export function tipoPelosBytes(base64Inicio: string): ExtensaoFoto | null {
  const b = bytesDoBase64(base64Inicio, 16);
  const ascii = (i: number, n: number) => String.fromCharCode(...b.slice(i, i + n));
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "jpg";
  if (b[0] === 0x89 && ascii(1, 3) === "PNG") return "png";
  if (ascii(0, 4) === "GIF8") return "gif";
  if (ascii(0, 4) === "RIFF" && ascii(8, 4) === "WEBP") return "webp";
  if (ascii(4, 4) === "ftyp" && ["heic", "heix", "hevc", "hevx", "heim", "heis", "mif1", "msf1"].includes(ascii(8, 4))) return "heic";
  return null;
}

const POR_TIPO: Record<string, ExtensaoFoto> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/pjpeg": "jpg",
  "image/png": "png",
  "image/heic": "heic",
  "image/heif": "heic",
  "image/webp": "webp",
  "image/gif": "gif",
};
const OCTETO = new Set(["application/octet-stream", "binary/octet-stream", ""]);

/**
 * Decide se o que baixou é foto e com qual extensão gravar. PURO.
 * `image/*` vale; `application/octet-stream` (o SharePoint às vezes manda assim)
 * só vale se os primeiros bytes forem de imagem; HTML/JSON/texto nunca.
 */
export function decidirTipoDaFoto(contentType: string | null | undefined, base64Inicio: string): { ext: ExtensaoFoto } | { erro: true } {
  const ct = String(contentType ?? "").split(";")[0].trim().toLowerCase();
  const pelosBytes = tipoPelosBytes(base64Inicio);
  if (ct.startsWith("image/")) return { ext: pelosBytes ?? POR_TIPO[ct] ?? "jpg" };
  if (OCTETO.has(ct) && pelosBytes) return { ext: pelosBytes };
  return { erro: true };
}

export function mimeDaExtensao(ext: ExtensaoFoto): string {
  return ext === "jpg" ? "image/jpeg" : `image/${ext}`;
}

/** Nome de arquivo seguro, com a extensão do tipo REAL. PURO. */
export function nomeDaFoto(nome: string, ext: ExtensaoFoto): string {
  const semExt = String(nome || "")
    .replace(/\.(jpe?g|png|heic|heif|webp|gif)$/i, "")
    .replace(/[\\/:*?"<>|\u0000-\u001f]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
  return `${semExt || "foto-batismo"}.${ext}`;
}

/** Cabeçalho sem depender de maiúscula/minúscula. PURO. */
export function cabecalho(headers: Record<string, string> | null | undefined, nome: string): string | null {
  const alvo = nome.toLowerCase();
  for (const [k, v] of Object.entries(headers || {})) if (k.toLowerCase() === alvo) return String(v);
  return null;
}

// ── Cancelamento que pausa o download em andamento ─────────────────────────

export type CancelamentoSalvar = Cancelamento & {
  /** Registra o que fazer no cancelamento (pausar o download). Devolve o "desregistrar". */
  aoCancelar(fn: () => void): () => void;
};

export function novoCancelamentoSalvar(): CancelamentoSalvar {
  const base = novoCancelamento();
  const ouvintes = new Set<() => void>();
  return {
    get cancelado() {
      return base.cancelado;
    },
    cancelar() {
      if (base.cancelado) return;
      base.cancelar();
      for (const f of [...ouvintes]) {
        try {
          f();
        } catch {
          /* pausar é melhor-esforço */
        }
      }
      ouvintes.clear();
    },
    aoCancelar(fn) {
      if (base.cancelado) {
        fn();
        return () => {};
      }
      ouvintes.add(fn);
      return () => {
        ouvintes.delete(fn);
      };
    },
  };
}

// ── Dependências (injetáveis no teste) ─────────────────────────────────────

/** O pedaço do `expo-media-library` que usamos. */
export type Galeria = {
  requestPermissionsAsync(writeOnly?: boolean, granular?: ("photo" | "video" | "audio")[]): Promise<{ granted: boolean; canAskAgain?: boolean }>;
  saveToLibraryAsync(localUri: string): Promise<void>;
};

export type FsSalvar = Pick<
  typeof FileSystem,
  | "cacheDirectory"
  | "makeDirectoryAsync"
  | "deleteAsync"
  | "readDirectoryAsync"
  | "getInfoAsync"
  | "createDownloadResumable"
  | "readAsStringAsync"
  | "writeAsStringAsync"
  | "moveAsync"
  | "StorageAccessFramework"
  | "EncodingType"
>;

export type DepsSalvar = {
  plataforma: Plataforma;
  galeria: () => Galeria | null;
  fs: FsSalvar;
  /** Abre a folha do sistema com o arquivo local (iPhone sem o módulo). */
  compartilhar: (uriLocal: string) => Promise<"compartilhado" | "dispensado">;
};

/** O binário instalado tem o módulo de galeria? (binário novo das lojas) */
export function temGaleriaNativa(): boolean {
  return Platform.OS !== "web" && !!requireOptionalNativeModule("ExpoMediaLibrary");
}

function carregarGaleria(): Galeria | null {
  if (!temGaleriaNativa()) return null;
  // ⚠️ require DENTRO da guarda: no binário sem o módulo, o simples import
  // executaria `requireNativeModule('ExpoMediaLibrary')` e derrubaria o app.
  return require("expo-media-library") as Galeria;
}

async function compartilharNaFolha(uriLocal: string): Promise<"compartilhado" | "dispensado"> {
  // ⚠️⚠️ "Salvar imagem" (SaveToCameraRoll) fica FORA da folha de propósito: o
  // binário do iPhone publicado hoje NÃO tem `NSPhotoLibraryAddUsageDescription`
  // no Info.plist, e o iOS ENCERRA o app quando alguém escolhe essa opção sem a
  // chave. A pessoa ainda tem "Salvar em Arquivos", AirDrop, WhatsApp etc. No
  // binário novo (com expo-media-library e a chave) a estratégia é "galeria" e
  // esta folha nem é usada.
  const r = await Share.share(
    { url: uriLocal },
    { excludedActivityTypes: ["com.apple.UIKit.activity.SaveToCameraRoll"] },
  );
  return r.action === Share.dismissedAction ? "dispensado" : "compartilhado";
}

function plataformaAtual(): Plataforma {
  return Platform.OS === "ios" ? "ios" : Platform.OS === "android" ? "android" : "outra";
}

export function depsReais(): DepsSalvar {
  return { plataforma: plataformaAtual(), galeria: carregarGaleria, fs: FileSystem, compartilhar: compartilharNaFolha };
}

/** Estratégia que ESTE aparelho usaria para `quantidade` fotos (a tela decide o texto por ela). */
export function estrategiaDoAparelho(quantidade: number, deps: Pick<DepsSalvar, "plataforma"> & { temGaleria?: boolean } = { plataforma: plataformaAtual() }): Estrategia {
  return escolherEstrategia({
    plataforma: deps.plataforma,
    temGaleria: deps.temGaleria ?? temGaleriaNativa(),
    quantidade,
  });
}

// ── Download de UMA foto para o cache ──────────────────────────────────────

type ResultadoDownload =
  | { tipo: "ok"; uri: string; contentType: string | null }
  | { tipo: "status"; status: number }
  | { tipo: "cancelado" }
  | { tipo: "tempo" }
  | { tipo: "falha" };

async function baixarUmaVez(
  fs: FsSalvar,
  url: string,
  destino: string,
  cancelamento: CancelamentoSalvar,
): Promise<ResultadoDownload> {
  if (cancelamento.cancelado) return { tipo: "cancelado" };
  let ultimoByte = Date.now();
  const inicio = ultimoByte;
  let expirou = false;
  const tarefa = fs.createDownloadResumable(url, destino, {}, () => {
    ultimoByte = Date.now();
  });
  const pausar = () => {
    tarefa.pauseAsync().catch(() => {});
  };
  const desregistrar = cancelamento.aoCancelar(pausar);
  const vigia = setInterval(() => {
    const agora = Date.now();
    if (agora - ultimoByte > SEM_PROGRESSO_MS || agora - inicio > TEMPO_MAXIMO_MS) {
      expirou = true;
      pausar();
    }
  }, 5_000);
  try {
    // ⚠️ Erro nativo (rede, URL) nunca chega cru à tela — e nunca com a URL dentro.
    const r = await tarefa.downloadAsync().catch(() => null);
    if (cancelamento.cancelado) return { tipo: "cancelado" };
    if (expirou) return { tipo: "tempo" };
    if (!r) return { tipo: "falha" };
    if (r.status !== 200) return { tipo: "status", status: r.status };
    return { tipo: "ok", uri: r.uri, contentType: cabecalho(r.headers, "content-type") };
  } finally {
    clearInterval(vigia);
    desregistrar();
  }
}

/**
 * Pede o link, baixa, confere e deixa a foto pronta em `pasta` com o nome e a
 * extensão certos. Falhou ou cancelou → apaga a pasta e lança.
 */
async function prepararFoto<T extends FotoParaSalvar>(
  foto: T,
  pasta: string,
  ctx: { fs: FsSalvar; obterLink: (f: T) => Promise<{ url: string }>; cancelamento: CancelamentoSalvar },
): Promise<{ uri: string; ext: ExtensaoFoto }> {
  const { fs, cancelamento } = ctx;
  await fs.makeDirectoryAsync(pasta, { intermediates: true });
  const temporario = `${pasta}download.tmp`;
  try {
    for (let tentativa = 0; ; tentativa += 1) {
      if (cancelamento.cancelado) throw new FotoCancelada();
      const link = await ctx.obterLink(foto);
      if (!linkDeDownloadValido(link?.url)) throw new Error(MENSAGENS.link);
      const r = await baixarUmaVez(fs, link.url, temporario, cancelamento);
      if (r.tipo === "cancelado") throw new FotoCancelada();
      if (r.tipo === "status" && STATUS_RENOVA_LINK.has(r.status) && tentativa === 0) {
        await fs.deleteAsync(temporario, { idempotent: true }).catch(() => {});
        continue;
      }
      if (r.tipo === "tempo") throw new Error(MENSAGENS.tempo);
      if (r.tipo !== "ok") throw new Error(MENSAGENS.download);
      const inicio = await fs
        .readAsStringAsync(r.uri, { encoding: fs.EncodingType.Base64, position: 0, length: 16 })
        .catch(() => "");
      const tipo = decidirTipoDaFoto(r.contentType, inicio);
      if ("erro" in tipo) throw new Error(MENSAGENS.formato);
      const final = `${pasta}${nomeDaFoto(foto.nome, tipo.ext)}`;
      await fs.moveAsync({ from: r.uri, to: final });
      return { uri: final, ext: tipo.ext };
    }
  } catch (e) {
    await fs.deleteAsync(pasta, { idempotent: true }).catch(() => {});
    throw e;
  }
}

/** Apaga sobras de lotes antigos (app fechado no meio). Só o PRÓPRIO prefixo. */
export function pastaDoLote(nome: string): boolean {
  return new RegExp(`^${PREFIXO_CACHE}-[0-9]+-[a-z0-9]+$`).test(nome);
}

async function limparSobras(fs: FsSalvar) {
  const raiz = fs.cacheDirectory;
  if (!raiz) return;
  const nomes = await fs.readDirectoryAsync(raiz);
  await Promise.all(
    nomes
      .filter(pastaDoLote)
      .slice(0, 50)
      .map(async (n) => {
        const info = await fs.getInfoAsync(raiz + n);
        if (info.exists && info.modificationTime && info.modificationTime * 1000 < Date.now() - SOBRA_ANTIGA_MS)
          await fs.deleteAsync(raiz + n, { idempotent: true });
      }),
  );
}

// ── O lote ─────────────────────────────────────────────────────────────────

export type ResultadoSalvar<T> =
  | {
      tipo: "fila";
      estrategia: "galeria" | "pasta" | "folha";
      resumo: ResumoFila<T>;
      /** Só na "folha": a pessoa fechou a folha sem escolher nada. */
      folhaDispensada: boolean;
    }
  | { tipo: "sem_permissao"; podePerguntarDeNovo: boolean }
  | { tipo: "precisa_atualizar" }
  | { tipo: "indisponivel" };

export type OpcoesSalvar<T> = {
  /** Link curto do original (pedido na hora de baixar cada foto). */
  obterLink: (foto: T) => Promise<{ url: string }>;
  cancelamento?: CancelamentoSalvar;
  aoProgredir?: (p: ProgressoFila) => void;
};

/** Resumo de lote que nem começou porque a pessoa desistiu (ex.: fechou o seletor de pasta). */
export function resumoCancelado<T>(itens: readonly T[]): ResumoFila<T> {
  return {
    total: itens.length,
    salvas: 0,
    falhas: 0,
    emAndamento: 0,
    canceladas: itens.length,
    falhou: [],
    situacao: "nada",
    cancelado: true,
  };
}

export async function salvarFotos<T extends FotoParaSalvar>(
  fotos: readonly T[],
  opcoes: OpcoesSalvar<T>,
  deps: DepsSalvar = depsReais(),
): Promise<ResultadoSalvar<T>> {
  const { fs } = deps;
  const galeria = deps.galeria();
  const estrategia = escolherEstrategia({ plataforma: deps.plataforma, temGaleria: !!galeria, quantidade: fotos.length });
  if (estrategia === "indisponivel" || !fs.cacheDirectory) return { tipo: "indisponivel" };
  if (estrategia === "atualizar_app") return { tipo: "precisa_atualizar" };
  const cancelamento = opcoes.cancelamento ?? novoCancelamentoSalvar();

  // Permissão/pasta ANTES de baixar qualquer byte.
  let pastaSaf: string | null = null;
  if (estrategia === "galeria" && galeria) {
    // Só ADICIONAR (iOS: "add only"; Android 13+: nada de ler a galeria).
    const p = await galeria.requestPermissionsAsync(true, ["photo"]);
    if (!p.granted) return { tipo: "sem_permissao", podePerguntarDeNovo: p.canAskAgain !== false };
  } else if (estrategia === "pasta") {
    const p = await fs.StorageAccessFramework.requestDirectoryPermissionsAsync();
    // Fechar o seletor é desistir, não erro.
    if (!p.granted) return { tipo: "fila", estrategia, resumo: resumoCancelado(fotos), folhaDispensada: false };
    pastaSaf = p.directoryUri;
  }

  await limparSobras(fs).catch(() => {});
  const lote = `${fs.cacheDirectory}${PREFIXO_CACHE}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}/`;
  let contador = 0;
  let folhaDispensada = false;

  try {
    const resumo = await executarFila(
      fotos,
      async (foto) => {
        contador += 1;
        const pasta = `${lote}${contador}/`;
        const pronta = await prepararFoto(foto, pasta, { fs, obterLink: opcoes.obterLink, cancelamento });
        try {
          if (estrategia === "galeria" && galeria) {
            try {
              await galeria.saveToLibraryAsync(pronta.uri);
            } catch {
              throw new Error(MENSAGENS.galeria);
            }
          } else if (estrategia === "pasta" && pastaSaf) {
            try {
              const base64 = await fs.readAsStringAsync(pronta.uri, { encoding: fs.EncodingType.Base64 });
              const nome = nomeDaFoto(foto.nome, pronta.ext).replace(/\.[a-z0-9]+$/i, "");
              const destino = await fs.StorageAccessFramework.createFileAsync(pastaSaf, nome, mimeDaExtensao(pronta.ext));
              await fs.writeAsStringAsync(destino, base64, { encoding: fs.EncodingType.Base64 });
            } catch {
              throw new Error(MENSAGENS.pasta);
            }
          } else {
            // iOS sem o módulo: uma foto, pela folha. A folha só fecha depois que
            // a ação escolhida terminou de ler o arquivo, então apagar em seguida é seguro.
            if ((await deps.compartilhar(pronta.uri)) === "dispensado") folhaDispensada = true;
          }
        } finally {
          await fs.deleteAsync(pasta, { idempotent: true }).catch(() => {});
        }
      },
      { concorrencia: CONCORRENCIA_POR_ESTRATEGIA[estrategia], cancelamento, aoProgredir: opcoes.aoProgredir },
    );
    return { tipo: "fila", estrategia, resumo, folhaDispensada };
  } finally {
    await fs.deleteAsync(lote, { idempotent: true }).catch(() => {});
  }
}
