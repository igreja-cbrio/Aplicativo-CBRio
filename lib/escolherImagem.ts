import { Alert } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { arquivoDaCapa, capaCabe } from "@/lib/capaGrupo";

export type ArquivoImagem = { uri: string; name: string; type: string };

const igual = (pt: string) => pt;

/**
 * Pega uma imagem da câmera ou da galeria, pronta pro `apiUpload`.
 * Devolve `null` se a permissão foi negada (e AVISA, senão a pessoa toca e nada
 * acontece), se o usuário cancelou, se o formato não é aceito pelo servidor
 * (HEIC, GIF…) ou se passa do teto de tamanho (estes dois também avisam).
 * `t` é o tradutor da tela (opcional; sem ele o aviso sai em português).
 * `exif:false` tira o GPS da foto antes de sair do aparelho.
 */
export async function escolherImagem(
  origem: "camera" | "galeria",
  t: (pt: string) => string = igual,
): Promise<ArquivoImagem | null> {
  const perm =
    origem === "camera"
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) {
    Alert.alert(
      t("Permissão necessária"),
      origem === "camera"
        ? t("Permita o acesso à câmera nos Ajustes para enviar imagens.")
        : t("Permita o acesso às fotos nos Ajustes para enviar imagens."),
    );
    return null;
  }
  const opts = { mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.6, exif: false };
  const res =
    origem === "camera"
      ? await ImagePicker.launchCameraAsync(opts)
      : await ImagePicker.launchImageLibraryAsync(opts);
  if (res.canceled || !res.assets?.[0]) return null;
  const asset = res.assets[0];
  if (!capaCabe(asset.fileSize)) {
    Alert.alert(t("Imagem grande demais"), t("Escolha uma imagem menor."));
    return null;
  }
  const arq = arquivoDaCapa(asset);
  if (!arq) Alert.alert(t("Formato não aceito"), t("Use uma imagem JPG, PNG ou WebP."));
  return arq;
}
