// SOBRAS DA CÂMERA NO CACHE · busca por selfie (24/11/2026).
//
// ⚠️ O texto do aceite promete que a selfie é apagada ao sair da tela. O
// `finally` de `tirarSelfie` (components/batismo/BuscaFacial.tsx) apaga a cópia
// que o picker devolve. Mas, no Android, o expo-image-picker 17 manda a câmera
// gravar a foto crua em `<cache>/ImagePicker/<uuid>.jpg` e só apaga esse
// arquivo quando a câmera volta para o app. Se o sistema matar o processo do
// CBRio com a câmera na frente (aparelho com pouca memória), nenhum dos dois
// `finally` roda e a selfie em resolução cheia fica no cache.
//
// Por isso a busca limpa a pasta do picker ao abrir. Só apaga arquivo com mais
// de `IDADE_MINIMA_MS`: as outras telas que usam o picker (perfil, Kids, grupo)
// mandam a foto logo depois de escolher, e um arquivo recente pode ser delas.
// Nunca lança erro: limpeza que falha não pode travar a busca.
import { Platform } from "react-native";
import * as FileSystem from "expo-file-system/legacy";

export const PASTA_DO_PICKER = "ImagePicker/";
export const IDADE_MINIMA_MS = 30 * 60_000;

/**
 * Régua pura: o arquivo `nome` da pasta do picker, modificado em `modificadoS`
 * (segundos desde 1970, como o `getInfoAsync` devolve), já é sobra?
 * Nome estranho ou data ausente: não apaga (na dúvida, fica).
 */
export function ehSobraDaCamera(nome: unknown, modificadoS: unknown, agoraMs: number): boolean {
  if (typeof nome !== "string" || !/^[A-Za-z0-9._-]+$/.test(nome) || /^\.+$/.test(nome)) return false;
  if (typeof modificadoS !== "number" || !Number.isFinite(modificadoS) || modificadoS <= 0) return false;
  return agoraMs - modificadoS * 1000 >= IDADE_MINIMA_MS;
}

export async function limparSobrasDaCamera(agoraMs: number = Date.now()): Promise<void> {
  if (Platform.OS === "web") return;
  try {
    const raiz = FileSystem.cacheDirectory;
    if (!raiz) return;
    const pasta = `${raiz}${PASTA_DO_PICKER}`;
    const info = await FileSystem.getInfoAsync(pasta);
    if (!info.exists || !info.isDirectory) return;
    const nomes = await FileSystem.readDirectoryAsync(pasta);
    for (const nome of nomes.slice(0, 200)) {
      try {
        const arq = await FileSystem.getInfoAsync(pasta + nome);
        if (!arq.exists || arq.isDirectory) continue;
        if (!ehSobraDaCamera(nome, arq.modificationTime, agoraMs)) continue;
        await FileSystem.deleteAsync(pasta + nome, { idempotent: true });
      } catch {
        /* um arquivo que não deu não impede os outros */
      }
    }
  } catch {
    /* limpeza é só higiene: nunca derruba a busca */
  }
}
