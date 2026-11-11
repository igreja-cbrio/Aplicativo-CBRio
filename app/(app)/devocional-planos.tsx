import { ScrollView } from "@/components/navigation/DockContent";
import { Text } from "@/components/ui/Typography";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Linking, Pressable, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, router } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useColors } from "@/contexts/ThemeContext";
import { apiGet } from "@/lib/api";
import { listarPlanos, planosSugeridos, type PlanoDevocional, type PlanoSugerido } from "@/lib/devocional";
import { useMembro } from "@/lib/useMembro";
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
  const { membro } = useMembro();
  // "Sugeridos" (movido da home do Devocional em 10/11/2026 — um único ponto de
  // "planos"). `null` = ainda não carregou · `falhou` = erro (nunca vira lista
  // vazia: "não há plano" e "não carregou" levam a leituras opostas).
  const [sugeridos, setSugeridos] = useState<PlanoSugerido[] | null>(null), [falhou, setFalhou] = useState(false);
  const carregarSugeridos = useCallback(() => {
    planosSugeridos(membro?.membroId ?? null).then((p) => { setSugeridos(p); setFalhou(false); }).catch(() => setFalhou(true));
  }, [membro?.membroId]);
  useFocusEffect(useCallback(() => { carregarSugeridos(); }, [carregarSugeridos]));
  const quarta = planos.find(p => p.slug === "quarta-com-deus");
  const semana = planos.find(p => !p.slug && p.titulo.toLowerCase().includes("semana"));
  function abrirPlano(plano?: PlanoDevocional) {
    if (!plano) return Alert.alert(t("Plano indisponível"), t("Este plano ainda não tem uma leitura publicada."));
    router.navigate({ pathname: "/devocional-plano", params: { planoId: plano.id } });
  }
  async function abrirPense() {
    if (!pense) return Alert.alert(t("Conteúdo indisponível"), t("O Pense mais recente ainda não carregou."));
    await Linking.openURL("https://www.youtube.com/watch?v=" + pense.video_id);
  }
  return <SafeAreaView style={s.safe} edges={["left", "right"]}><Stack.Screen options={{ headerShown: false }} />
    <View style={s.header}><Pressable onPress={() => subirUmNivel()} hitSlop={12} style={s.back}><Ionicons name="chevron-back" size={24} color={c.text} /></Pressable><Text style={s.headerTitle}>{t("Planos de leitura")}</Text><View style={s.back} /></View>
    <ScrollView contentContainerStyle={s.content}><Text style={s.eyebrow}>{t("ESCOLHA SUA JORNADA")}</Text><Text style={s.title}>{t("Um caminho para cada ritmo")}</Text><Text style={s.subtitle}>{t("Abra uma opção e siga uma leitura por dia.")}</Text>
      <Card icon="play" numero="01" titulo="Pense Pedrão" texto={pense?.titulo ?? t("Uma mensagem breve para o seu dia")} onPress={abrirPense} s={s} c={c} />
      <Card icon="flame-outline" numero="02" titulo="Quarta com Deus" texto={t("Sete leituras, de quinta a quarta")} onPress={() => abrirPlano(quarta)} s={s} c={c} />
      <Card icon="calendar-outline" numero="03" titulo={t("Devocional da semana")} texto={t("A leitura preparada para esta semana")} onPress={() => abrirPlano(semana)} s={s} c={c} />
      <Text style={s.secao}>{t("PLANOS SUGERIDOS")}</Text>
      {falhou && !sugeridos
        ? <Pressable onPress={carregarSugeridos} style={s.erroBox} accessibilityRole="button"><Ionicons name="cloud-offline-outline" size={18} color={c.textMuted} /><Text style={s.erroTxt}>{t("Não foi possível carregar os planos.")}</Text><Text style={s.erroRetry}>{t("Tentar de novo")}</Text></Pressable>
        : !sugeridos
          ? <ActivityIndicator color={c.primary} style={{ marginVertical: 24 }} />
          : sugeridos.length === 0
            ? <Text style={s.vazioTxt}>{t("Nenhum plano aberto para inscrição no momento.")}</Text>
            : <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.carrossel} style={s.carrosselWrap}>
              {sugeridos.map((p) => <PlanoCard key={p.id} plano={p} onPress={() => router.navigate({ pathname: "/devocional-plano", params: { planoId: p.id } })} styles={s} colors={c} t={t} />)}
            </ScrollView>}
    </ScrollView>
  </SafeAreaView>;
}
function PlanoCard({ plano, onPress, styles, colors, t }: { plano: PlanoSugerido; onPress: () => void; styles: any; colors: any; t: (s: string) => string }) {
  const ritmo = plano.continuo ? t("Contínuo") : plano.total_dias ? `${plano.total_dias} ${plano.total_dias === 1 ? t("dia") : t("dias")}` : t("Em breve");
  return <Pressable onPress={onPress} style={({ pressed }) => [styles.plano, plano.destaque && styles.planoDestaque, pressed && styles.pressed]} accessibilityRole="button">
    <View style={styles.planoTopo}>
      <View style={[styles.planoIcone, plano.destaque && styles.planoIconeDestaque]}><Ionicons name={plano.continuo ? "calendar-outline" : "flag-outline"} size={20} color={plano.destaque ? "#fff" : colors.primary} /></View>
      {plano.inscrito && <View style={[styles.badge, plano.destaque && styles.badgeDestaque]}><Ionicons name="checkmark-circle" size={12} color={plano.destaque ? "#fff" : colors.primary} /><Text style={[styles.badgeTxt, plano.destaque && styles.badgeTxtDestaque]}>{t("Inscrito")}</Text></View>}
    </View>
    <Text style={[styles.planoTitulo, plano.destaque && styles.planoTituloDestaque]} numberOfLines={2}>{plano.titulo}</Text>
    {!!plano.descricao && <Text style={[styles.planoDesc, plano.destaque && styles.planoDescDestaque]} numberOfLines={3}>{plano.descricao}</Text>}
    <View style={styles.planoRodape}><Text style={[styles.planoRitmo, plano.destaque && styles.planoRitmoDestaque]}>{ritmo}</Text><Ionicons name="arrow-forward" size={16} color={plano.destaque ? "#fff" : colors.primary} /></View>
  </Pressable>;
}
function Card({ icon, numero, titulo, texto, onPress, s, c }: any) { return <Pressable onPress={onPress} style={({ pressed }) => [s.card, pressed && s.pressed]}><View style={s.number}><Text style={s.numberText}>{numero}</Text></View><View style={s.icon}><Ionicons name={icon} size={23} color={c.primary} /></View><View style={s.flex}><Text style={s.cardTitle}>{titulo}</Text><Text style={s.cardText} numberOfLines={2}>{texto}</Text></View><Ionicons name="chevron-forward" size={20} color={c.textMuted} /></Pressable>; }
const css = (c: any) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.background }, header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingVertical: 14 }, back: { width: 32, minHeight: 32, justifyContent: "center" }, headerTitle: { flex: 1, textAlign: "center", color: c.text, fontSize: 18, fontWeight: "800" },
  content: { paddingHorizontal: 20, paddingBottom: 64, gap: 13 }, eyebrow: { color: c.primary, fontSize: 11, fontWeight: "800", letterSpacing: 1.4, marginTop: 8 }, title: { color: c.text, fontSize: 29, fontWeight: "900", lineHeight: 34 }, subtitle: { color: c.textMuted, lineHeight: 21, marginBottom: 6 },
  card: { minHeight: 112, backgroundColor: c.surface, borderRadius: 19, padding: 15, flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderColor: c.border }, number: { position: "absolute", right: 14, top: 8 }, numberText: { color: c.border, fontSize: 28, fontWeight: "900" },
  icon: { width: 44, height: 44, borderRadius: 15, backgroundColor: c.background, alignItems: "center", justifyContent: "center" }, flex: { flex: 1, zIndex: 1 }, cardTitle: { color: c.text, fontSize: 18, fontWeight: "800" }, cardText: { color: c.textMuted, fontSize: 13, lineHeight: 18, marginTop: 4 }, pressed: { opacity: .7 },
  secao: { color: c.textMuted, fontSize: 10, fontWeight: "800", letterSpacing: 1.4, marginTop: 14 },
  // Planos sugeridos · carrossel horizontal. O ScrollView sangra 20px de cada
  // lado (margin negativa) pra o cartão encostar na borda da tela ao rolar.
  carrosselWrap: { marginHorizontal: -20 }, carrossel: { paddingHorizontal: 20, gap: 12, paddingBottom: 4 },
  plano: { width: 250, minHeight: 190, backgroundColor: c.surface, borderRadius: 20, padding: 16, borderWidth: 1, borderColor: c.border, justifyContent: "space-between", gap: 8 }, planoDestaque: { backgroundColor: c.primary, borderColor: c.primary },
  planoTopo: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, planoIcone: { width: 38, height: 38, borderRadius: 12, backgroundColor: c.background, alignItems: "center", justifyContent: "center" }, planoIconeDestaque: { backgroundColor: "rgba(255,255,255,.18)" },
  badge: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: c.background, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4 }, badgeDestaque: { backgroundColor: "rgba(255,255,255,.18)" }, badgeTxt: { color: c.primary, fontSize: 11, fontWeight: "800" }, badgeTxtDestaque: { color: "#fff" },
  planoTitulo: { color: c.text, fontSize: 17, fontWeight: "800", lineHeight: 21 }, planoTituloDestaque: { color: "#fff" }, planoDesc: { color: c.textMuted, fontSize: 12, lineHeight: 17, flexGrow: 1 }, planoDescDestaque: { color: "rgba(255,255,255,.84)" },
  planoRodape: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 4 }, planoRitmo: { color: c.primary, fontSize: 12, fontWeight: "800", letterSpacing: .6 }, planoRitmoDestaque: { color: "#fff" },
  erroBox: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: 16, padding: 14, flexWrap: "wrap" }, erroTxt: { color: c.textMuted, fontSize: 13, flex: 1 }, erroRetry: { color: c.primary, fontSize: 13, fontWeight: "800" },
  vazioTxt: { color: c.textMuted, fontSize: 13, lineHeight: 19 },
});
