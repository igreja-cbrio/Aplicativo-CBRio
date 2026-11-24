// TELA ACORDADA durante a busca por selfie (24/11/2026) · SEM dependência nova.
//
// O módulo nativo `ExpoKeepAwake` vem com o pacote `expo` (o autolinking o acha
// em node_modules/expo/node_modules/expo-keep-awake). O pacote JS NÃO é
// importado: ele não está na raiz do node_modules e não entra no package.json
// (tudo desta busca tem de sair por OTA). Falamos direto com o nativo, pela
// mesma guarda `requireOptionalNativeModule` de `lib/salvarFotos.ts`: binário
// sem o módulo ⇒ não faz nada (a tela pode apagar; a busca retoma na volta).
import { Platform } from "react-native";
import { requireOptionalNativeModule } from "expo";

type ModuloTelaAcordada = {
  activate?: (tag: string) => Promise<void>;
  deactivate?: (tag: string) => Promise<void>;
};

function modulo(): ModuloTelaAcordada | null {
  if (Platform.OS === "web") return null;
  try {
    return requireOptionalNativeModule<ModuloTelaAcordada>("ExpoKeepAwake");
  } catch {
    return null;
  }
}

/** Impede a tela de apagar até `liberarTela(tag)`. Nunca lança. */
export function manterTelaAcordada(tag: string): void {
  try {
    modulo()?.activate?.(tag)?.catch(() => {});
  } catch {
    /* sem o nativo: segue sem manter acordada */
  }
}

export function liberarTela(tag: string): void {
  try {
    modulo()?.deactivate?.(tag)?.catch(() => {});
  } catch {
    /* idem */
  }
}
