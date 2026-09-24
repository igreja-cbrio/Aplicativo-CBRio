import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { escalar } from "@/lib/fonteLeitura";
import { FONTE_SERIF } from "@/lib/fonteSerif";
import { paragrafos } from "@/lib/paragrafos";

/**
 * Peças de LEITURA do devocional (24/09/2026 · pedidos do Marcos: "destaque o
 * texto bíblico dos demais, igual à aba Bíblia" e "separe mais por parágrafo").
 *
 * `PassagemBiblica` = a estética do leitor da Bíblia (`biblia.tsx`): papel
 * #FBFAF7, serifa, cores FIXAS — não segue o tema escuro DE PROPÓSITO, é a
 * mesma decisão da aba Bíblia. `TextoDevocional` = os parágrafos curtos, na
 * cor do tema. Os dois recebem o `passo` do A−/A+ (`useFonteLeitura`).
 */
const BASE_PASSAGEM = { fontSize: 19, lineHeight: 32 };
const BASE_TEXTO = { fontSize: 15, lineHeight: 24 };

export function PassagemBiblica({ referencia, texto, passo, selecionado, onPress, children }: {
  referencia?: string | null; texto: string; passo: number; selecionado?: boolean; onPress?: () => void; children?: ReactNode;
}) {
  const tam = escalar(BASE_PASSAGEM, passo);
  return <Pressable onPress={onPress} disabled={!onPress} style={[s.papel, selecionado && s.papelSelecionado]} accessibilityRole={onPress ? "button" : undefined}>
    {!!referencia && <View style={s.refRow}><View style={s.refLinha} /><Text style={s.ref}>{referencia}</Text><View style={s.refLinha} /></View>}
    {paragrafos(texto, 3).map((p, i) => <Text key={i} style={[s.versiculo, { fontSize: tam.fontSize, lineHeight: tam.lineHeight }, i > 0 && { marginTop: Math.round(tam.lineHeight * .35) }]}>{p}</Text>)}
    {children}
  </Pressable>;
}

export function TextoDevocional({ texto, passo, cor, italico }: { texto: string | null | undefined; passo: number; cor: string; italico?: boolean }) {
  const tam = escalar(BASE_TEXTO, passo);
  const ps = paragrafos(texto);
  if (!ps.length) return null;
  return <View>
    {ps.map((p, i) => <Text key={i} style={[s.paragrafo, { color: cor, fontSize: tam.fontSize, lineHeight: tam.lineHeight }, i > 0 && { marginTop: Math.round(tam.lineHeight * .55) }, italico && s.italico]}>{p}</Text>)}
  </View>;
}

const s = StyleSheet.create({
  papel: { backgroundColor: "#FBFAF7", borderRadius: 18, paddingHorizontal: 20, paddingVertical: 18, borderWidth: 1, borderColor: "#DDD8CE" },
  papelSelecionado: { borderColor: "#70A8B0", backgroundColor: "#F6F8F5" },
  refRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 }, refLinha: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: "#CFC9BE" },
  ref: { color: "#738083", fontSize: 11, fontWeight: "800", letterSpacing: 1.4, textTransform: "uppercase" },
  versiculo: { color: "#252827", fontFamily: FONTE_SERIF },
  paragrafo: { opacity: .94 }, italico: { fontStyle: "italic" },
});
