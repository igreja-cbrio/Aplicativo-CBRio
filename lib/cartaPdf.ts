import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { Linking, Platform } from "react-native";
import { obterCartaPdf } from "./cartaTransferencia";

// O chooser do Android pode retornar antes de o destinatário ler o anexo.
// Preserve PDFs compartilhados por 24h; limpe apenas nosso cache, em uso posterior.
async function limparCacheAntigo() {
  const root = FileSystem.cacheDirectory;
  if (!root) return;
  const nomes = await FileSystem.readDirectoryAsync(root);
  await Promise.all(
    nomes
      .filter((n) => /^carta-[0-9]+-[a-z0-9]+$/.test(n))
      .slice(0, 100)
      .map(async (n) => {
        const info = await FileSystem.getInfoAsync(root + n);
        if (
          info.exists &&
          info.modificationTime &&
          info.modificationTime * 1000 < Date.now() - 86400000
        )
          await FileSystem.deleteAsync(root + n, { idempotent: true });
      }),
  );
}

/** URL curta da API autenticada. Cache temporário sem nome/dados da pessoa. */
export async function compartilharCartaPdf(id: string) {
  const { url } = await obterCartaPdf(id);
  if (Platform.OS === "web") {
    await Linking.openURL(url);
    return;
  }
  if (!FileSystem.cacheDirectory || !(await Sharing.isAvailableAsync()))
    throw new Error("Compartilhamento indisponível neste dispositivo.");
  await limparCacheAntigo().catch(() => {});
  const dir = `${FileSystem.cacheDirectory}carta-${Date.now()}-${Math.random().toString(36).slice(2)}/`;
  await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  const tarefa = FileSystem.createDownloadResumable(
    url,
    `${dir}carta-de-transferencia.pdf`,
  );
  let expirou = false;
  let compartilhamentoIniciado = false;
  const timer = setTimeout(() => {
    expirou = true;
    tarefa.pauseAsync().catch(() => {});
  }, 45000);
  try {
    const r = await tarefa.downloadAsync();
    clearTimeout(timer);
    if (
      expirou ||
      !r ||
      r.status !== 200 ||
      !Object.entries(r.headers || {}).some(
        ([k, v]) =>
          k.toLowerCase() === "content-type" &&
          String(v).includes("application/pdf"),
      )
    )
      throw new Error("Não foi possível baixar a carta. Tente novamente.");
    compartilhamentoIniciado = true;
    await Sharing.shareAsync(r.uri, {
      mimeType: "application/pdf",
      UTI: "com.adobe.pdf",
      dialogTitle: "Carta de transferência",
    });
  } finally {
    clearTimeout(timer);
    if (!compartilhamentoIniciado)
      await FileSystem.deleteAsync(dir, { idempotent: true }).catch(() => {});
  }
}
