import * as ImagePicker from "expo-image-picker";
import { arquivoDaCapa, capaCabe } from "@/lib/capaGrupo";

export type ArquivoImagem = { uri: string; name: string; type: string };

/**
 * Pega uma imagem da câmera ou da galeria, pronta pro `apiUpload`.
 * Devolve `null` se a permissão foi negada, se o usuário cancelou, se o formato
 * não é aceito pelo servidor (HEIC, GIF…) ou se passa do teto de tamanho.
 * `exif:false` tira o GPS da foto antes de sair do aparelho.
 */
export async function escolherImagem(origem: "camera" | "galeria"): Promise<ArquivoImagem | null> {
  const perm =
    origem === "camera"
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return null;
  const opts = { mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.6, exif: false };
  const res =
    origem === "camera"
      ? await ImagePicker.launchCameraAsync(opts)
      : await ImagePicker.launchImageLibraryAsync(opts);
  if (res.canceled || !res.assets?.[0]) return null;
  const asset = res.assets[0];
  if (!capaCabe(asset.fileSize)) return null;
  return arquivoDaCapa(asset);
}
