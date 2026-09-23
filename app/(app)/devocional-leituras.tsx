import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useColors } from "@/contexts/ThemeContext";
import { resumoMinhasLeituras, type ResumoPlano } from "@/lib/devocional";
import { subirUmNivel } from "@/lib/hierarquia";
import { useMembro } from "@/lib/useMembro";
import { useT } from "@/lib/i18n";

export default function Leituras() {
  const c = useColors(), s = useMemo(() => css(c), [c]), t = useT(), { membro } = useMembro();
  const [leituras, setLeituras] = useState<{ data_leitura: string; referencia: string }[]>([]), [planos, setPlanos] = useState<ResumoPlano[]>([]), [loading, setLoading] = useState(true);
  const carregar = useCallback(async () => { if (!membro?.membroId) return; const r = await resumoMinhasLeituras(membro.membroId); setLeituras(r.leituras); setPlanos(r.planos); setLoading(false); }, [membro?.membroId]);
  useEffect(() => { carregar().catch(e => Alert.alert(t("Erro"), e.message)); }, [carregar, t]);
  const dias = [...new Set(leituras.map(x => x.data_leitura))];
  const mes = new Date().toISOString().slice(0, 7), diasMes = dias.filter(d => d.startsWith(mes)).length;
  const concluidos = planos.filter(p => p.concluido);
  return <SafeAreaView style={s.safe} edges={["top", "left", "right"]}><Stack.Screen options={{ headerShown: false }} />
    <View style={s.header}><Pressable onPress={() => subirUmNivel()} hitSlop={12} style={s.back}><Ionicons name="chevron-back" size={24} color={c.text} /></Pressable><Text style={s.headerTitle}>{t("Leituras da Bíblia")}</Text><View style={s.back} /></View>
    <ScrollView contentContainerStyle={s.content}>{loading ? <ActivityIndicator color={c.primary} /> : <>
      <View style={s.hero}><Text style={s.heroLabel}>{t("NESTE MÊS")}</Text><Text style={s.heroNumber}>{diasMes}</Text><Text style={s.heroText}>{diasMes === 1 ? t("dia com leitura da Bíblia") : t("dias com leitura da Bíblia")}</Text><View style={s.heroRule} /><Text style={s.total}>{dias.length} {t("dias registrados no total")}</Text></View>
      <Text style={s.section}>{t("Leituras recentes")}</Text>{leituras.length === 0 ? <Text style={s.empty}>{t("Quando você abrir um capítulo, ele aparecerá aqui.")}</Text> : leituras.slice(0, 12).map((l, i) => <View key={l.data_leitura + l.referencia + i} style={s.reading}><View style={s.readingIcon}><Ionicons name="book-outline" size={18} color={c.primary} /></View><View style={s.flex}><Text style={s.readingRef}>{l.referencia}</Text><Text style={s.readingDate}>{new Date(l.data_leitura + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "long" })}</Text></View></View>)}
      <Text style={s.section}>{t("Planos concluídos")}</Text>{concluidos.length === 0 ? <Text style={s.empty}>{t("Seus planos concluídos aparecerão aqui.")}</Text> : concluidos.map((p, i) => <View key={p.plano_titulo + p.edicao_titulo + i} style={s.plan}><View style={s.check}><Ionicons name="checkmark" size={18} color="#fff" /></View><View style={s.flex}><Text style={s.planTitle}>{p.plano_titulo}</Text><Text style={s.planEdition}>{p.edicao_titulo}</Text></View><Text style={s.planCount}>{p.itens_lidos}/{p.total_itens}</Text></View>)}
      {planos.some(p => !p.concluido) && <><Text style={s.section}>{t("Em andamento")}</Text>{planos.filter(p => !p.concluido).map((p, i) => <View key={p.plano_titulo + i} style={s.progress}><View style={s.progressTop}><Text style={s.planTitle}>{p.plano_titulo}</Text><Text style={s.planCount}>{p.itens_lidos}/{p.total_itens}</Text></View><View style={s.track}><View style={[s.fill, { width: (Math.min(100, p.itens_lidos / p.total_itens * 100) + "%") as any }]} /></View></View>)}</>}
    </>}</ScrollView>
  </SafeAreaView>;
}
const css = (c: any) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.background }, header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingVertical: 14 }, back: { width: 32, minHeight: 32, justifyContent: "center" }, headerTitle: { flex: 1, color: c.text, textAlign: "center", fontSize: 17, fontWeight: "800" },
  content: { paddingHorizontal: 20, paddingBottom: 64, gap: 11 }, hero: { backgroundColor: c.primary, borderRadius: 22, padding: 22, marginBottom: 10 }, heroLabel: { color: "rgba(255,255,255,.72)", fontSize: 10, fontWeight: "800", letterSpacing: 1.4 }, heroNumber: { color: "#fff", fontSize: 54, fontWeight: "900", lineHeight: 61 }, heroText: { color: "#fff", fontSize: 16, fontWeight: "700" }, heroRule: { height: StyleSheet.hairlineWidth, backgroundColor: "rgba(255,255,255,.3)", marginVertical: 15 }, total: { color: "rgba(255,255,255,.82)", fontSize: 12 },
  section: { color: c.text, fontSize: 19, fontWeight: "900", marginTop: 13 }, empty: { color: c.textMuted, lineHeight: 21, backgroundColor: c.surface, padding: 16, borderRadius: 15 }, reading: { flexDirection: "row", alignItems: "center", gap: 11, backgroundColor: c.surface, padding: 13, borderRadius: 15, borderWidth: 1, borderColor: c.border }, readingIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: c.background, alignItems: "center", justifyContent: "center" }, flex: { flex: 1 }, readingRef: { color: c.text, fontWeight: "800" }, readingDate: { color: c.textMuted, fontSize: 12, marginTop: 3 },
  plan: { flexDirection: "row", alignItems: "center", gap: 11, backgroundColor: c.surface, padding: 14, borderRadius: 16, borderWidth: 1, borderColor: c.border }, check: { width: 34, height: 34, borderRadius: 17, backgroundColor: c.success ?? "#4D8B67", alignItems: "center", justifyContent: "center" }, planTitle: { color: c.text, fontWeight: "800" }, planEdition: { color: c.textMuted, fontSize: 12, marginTop: 3 }, planCount: { color: c.primary, fontSize: 12, fontWeight: "800" },
  progress: { backgroundColor: c.surface, padding: 15, borderRadius: 16, gap: 10, borderWidth: 1, borderColor: c.border }, progressTop: { flexDirection: "row", justifyContent: "space-between" }, track: { height: 7, borderRadius: 4, backgroundColor: c.background, overflow: "hidden" }, fill: { height: 7, borderRadius: 4, backgroundColor: c.primary },
});
