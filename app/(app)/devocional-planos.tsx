import { useEffect, useMemo, useState } from "react";
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useColors } from "@/contexts/ThemeContext";
import { apiGet } from "@/lib/api";
import { listarPlanos, type PlanoDevocional } from "@/lib/devocional";
import { subirUmNivel } from "@/lib/hierarquia";
import { useT } from "@/lib/i18n";

type Pense = { video_id: string; titulo: string };
export default function Planos() {
  const c = useColors(), s = useMemo(() => css(c), [c]), t = useT();
  const [planos, setPlanos] = useState<PlanoDevocional[]>([]), [pense, setPense] = useState<Pense | null>(null);
  useEffect(() => {
    listarPlanos(null).then(setPlanos).catch(e => Alert.alert(t("Erro"), e.message));
    apiGet<{ video: Pense | null }>("/app/pense-ultimo").then(r => setPense(r.video)).catch(() => undefined);
  }, [t]);
  const quarta = planos.find(p => p.slug === "quarta-com-deus");
  const semana = planos.find(p => !p.slug && p.titulo.toLowerCase().includes("semana"));
  function abrirPlano(plano?: PlanoDevocional) {
    if (!plano) return Alert.alert(t("Plano indisponível"), t("Este plano ainda não tem uma leitura publicada."));
    router.navigate({ pathname: "/devocional-diario", params: { planoId: plano.id, titulo: plano.titulo, ciclo: plano.slug === "quarta-com-deus" ? "quinta-quarta" : "segunda-sexta" } });
  }
  async function abrirPense() {
    if (!pense) return Alert.alert(t("Conteúdo indisponível"), t("O Pense mais recente ainda não carregou."));
    await Linking.openURL("https://www.youtube.com/watch?v=" + pense.video_id);
  }
  return <SafeAreaView style={s.safe} edges={["top", "left", "right"]}><Stack.Screen options={{ headerShown: false }} />
    <View style={s.header}><Pressable onPress={() => subirUmNivel()} hitSlop={12} style={s.back}><Ionicons name="chevron-back" size={24} color={c.text} /></Pressable><Text style={s.headerTitle}>{t("Planos de leitura")}</Text><View style={s.back} /></View>
    <ScrollView contentContainerStyle={s.content}><Text style={s.eyebrow}>{t("ESCOLHA SUA JORNADA")}</Text><Text style={s.title}>{t("Um caminho para cada ritmo")}</Text><Text style={s.subtitle}>{t("Abra uma opção e siga uma leitura por dia.")}</Text>
      <Card icon="play" numero="01" titulo="Pense Pedrão" texto={pense?.titulo ?? t("Uma mensagem breve para o seu dia")} onPress={abrirPense} s={s} c={c} />
      <Card icon="flame-outline" numero="02" titulo="Quarta com Deus" texto={t("Sete leituras, de quinta a quarta")} onPress={() => abrirPlano(quarta)} s={s} c={c} />
      <Card icon="calendar-outline" numero="03" titulo={t("Devocional da semana")} texto={t("A leitura preparada para esta semana")} onPress={() => abrirPlano(semana)} s={s} c={c} />
    </ScrollView>
  </SafeAreaView>;
}
function Card({ icon, numero, titulo, texto, onPress, s, c }: any) { return <Pressable onPress={onPress} style={({ pressed }) => [s.card, pressed && s.pressed]}><View style={s.number}><Text style={s.numberText}>{numero}</Text></View><View style={s.icon}><Ionicons name={icon} size={23} color={c.primary} /></View><View style={s.flex}><Text style={s.cardTitle}>{titulo}</Text><Text style={s.cardText} numberOfLines={2}>{texto}</Text></View><Ionicons name="chevron-forward" size={20} color={c.textMuted} /></Pressable>; }
const css = (c: any) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.background }, header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingVertical: 14 }, back: { width: 32, minHeight: 32, justifyContent: "center" }, headerTitle: { flex: 1, textAlign: "center", color: c.text, fontSize: 18, fontWeight: "800" },
  content: { paddingHorizontal: 20, paddingBottom: 64, gap: 13 }, eyebrow: { color: c.primary, fontSize: 11, fontWeight: "800", letterSpacing: 1.4, marginTop: 8 }, title: { color: c.text, fontSize: 29, fontWeight: "900", lineHeight: 34 }, subtitle: { color: c.textMuted, lineHeight: 21, marginBottom: 6 },
  card: { minHeight: 112, backgroundColor: c.surface, borderRadius: 19, padding: 15, flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderColor: c.border }, number: { position: "absolute", right: 14, top: 8 }, numberText: { color: c.border, fontSize: 28, fontWeight: "900" },
  icon: { width: 44, height: 44, borderRadius: 15, backgroundColor: c.background, alignItems: "center", justifyContent: "center" }, flex: { flex: 1, zIndex: 1 }, cardTitle: { color: c.text, fontSize: 18, fontWeight: "800" }, cardText: { color: c.textMuted, fontSize: 13, lineHeight: 18, marginTop: 4 }, pressed: { opacity: .7 },
});
