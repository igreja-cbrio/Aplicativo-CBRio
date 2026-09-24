import { Pressable, StyleSheet, Text, View } from "react-native";
import { useT } from "@/lib/i18n";
import { PASSOS_FONTE } from "@/lib/fonteLeitura";

/**
 * A− / A+ das telas de leitura (Bíblia · devocional). Recebe o passo e o
 * `mudar` de `useFonteLeitura`. `papel` = paleta clara da Bíblia (a leitura
 * tem fundo de papel fixo e não segue o tema); senão usa as cores do tema.
 */
export function ControleFonte({ passo, mudar, papel, cor, fundo }: { passo: number; mudar: (d: -1 | 1) => void; papel?: boolean; cor?: string; fundo?: string }) {
  const t = useT();
  const tinta = papel ? "#263234" : (cor ?? "#263234"), bg = papel ? "#EFEDE7" : (fundo ?? "rgba(255,255,255,.12)");
  const noMin = passo <= 0, noMax = passo >= PASSOS_FONTE.length - 1;
  return <View style={[s.wrap, { backgroundColor: bg }]}>
    <Pressable onPress={() => mudar(-1)} disabled={noMin} hitSlop={6} style={[s.btn, noMin && s.off]} accessibilityRole="button" accessibilityLabel={t("Diminuir letra")}><Text style={[s.txt, { color: tinta, fontSize: 12 }]}>A</Text><Text style={[s.sinal, { color: tinta }]}>−</Text></Pressable>
    <View style={[s.rule, { backgroundColor: tinta, opacity: .18 }]} />
    <Pressable onPress={() => mudar(1)} disabled={noMax} hitSlop={6} style={[s.btn, noMax && s.off]} accessibilityRole="button" accessibilityLabel={t("Aumentar letra")}><Text style={[s.txt, { color: tinta, fontSize: 17 }]}>A</Text><Text style={[s.sinal, { color: tinta }]}>+</Text></Pressable>
  </View>;
}

const s = StyleSheet.create({
  wrap: { flexDirection: "row", alignItems: "center", borderRadius: 10, height: 36, paddingHorizontal: 2 },
  btn: { flexDirection: "row", alignItems: "flex-end", paddingHorizontal: 8, height: 36, justifyContent: "center", gap: 1 },
  off: { opacity: .3 },
  txt: { fontWeight: "900", fontFamily: "Georgia", lineHeight: 20 },
  sinal: { fontSize: 11, fontWeight: "900", lineHeight: 20 },
  rule: { width: StyleSheet.hairlineWidth, height: 20 },
});
