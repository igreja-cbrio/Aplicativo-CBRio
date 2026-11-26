import { dataUrlDaSelfie } from "./selfieImagem";

type FotoTemporaria = { uri: string; base64?: string };
/** A limpeza também acontece se a tela fechar enquanto a câmera resolve a foto. */
export async function capturarSelfieEmMemoria(
  capturar: () => Promise<FotoTemporaria>,
  apagar: (uri: string) => Promise<unknown>,
): Promise<string | null> {
  let foto: FotoTemporaria | undefined;
  try {
    foto = await capturar();
    return dataUrlDaSelfie(foto.base64);
  } finally {
    if (foto?.uri) await apagar(foto.uri);
  }
}
