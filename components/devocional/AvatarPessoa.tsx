import { Image, StyleSheet, View } from "react-native";
import { Text } from "@/components/ui/Typography";

/** Foto (quando é URL) ou a inicial do nome, num círculo. Leitura em grupo. */
export function AvatarPessoa({ nome, foto, tamanho = 36, cor, borda }: { nome: string; foto?: string | null; tamanho?: number; cor: string; borda?: string }) {
  const estilo = { width: tamanho, height: tamanho, borderRadius: tamanho / 2, borderColor: borda ?? "transparent", borderWidth: borda ? 2 : 0 };
  if (foto && /^https?:\/\//.test(foto)) return <Image source={{ uri: foto }} style={[s.base, estilo]} />;
  return <View style={[s.base, estilo, { backgroundColor: cor }]}>
    <Text style={{ color: "#fff", fontWeight: "800", fontSize: Math.round(tamanho * .42) }}>{(nome || "?").trim().charAt(0).toUpperCase()}</Text>
  </View>;
}

const s = StyleSheet.create({ base: { alignItems: "center", justifyContent: "center", overflow: "hidden" } });
