import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, router } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useColors } from "@/contexts/ThemeContext";
import { useT } from "@/lib/i18n";
import { useMembro } from "@/lib/useMembro";
import { planosSugeridos, type PlanoSugerido } from "@/lib/devocional";

type Icone = keyof typeof Ionicons.glyphMap;
export default function DevocionalHome() {
  const colors = useColors(), styles = useMemo(() => css(colors), [colors]), t = useT();
  const { membro } = useMembro();
  // "Planos sugeridos" (24/09/2026): carrossel dos planos com inscrição
  // habilitada. `null` = ainda não carregou · `falhou` = erro (nunca vira lista
  // vazia — "não há plano" e "não carregou" levam a leituras opostas).
  const [planos, setPlanos] = useState<PlanoSugerido[] | null>(null);
  const [falhou, setFalhou] = useState(false);
  const carregar = useCallback(() => {
    planosSugeridos(membro?.membroId ?? null).then((p) => { setPlanos(p); setFalhou(false); }).catch(() => setFalhou(true));
  }, [membro?.membroId]);
  useFocusEffect(useCallback(() => { carregar(); }, [carregar]));

  // Plano por CALENDÁRIO (contínuo) abre o diário; plano por INSCRIÇÃO abre a
  // tela do plano, onde a pessoa se inscreve e lê um dia por vez.
  function abrirPlano(p: PlanoSugerido) {
    // Todo plano abre na mesma tela (25/09/2026); o ritmo vem do dado.
    router.navigate({ pathname: "/devocional-plano", params: { planoId: p.id } });
  }
  return <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
    <Stack.Screen options={{ headerShown: false }} />
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.intro}><Text style={styles.eyebrow}>{t("SUA JORNADA COM A PALAVRA")}</Text><Text style={styles.title}>{t("Devocional")}</Text><Text style={styles.subtitle}>{t("Leia, reflita e guarde o que Deus falou com você.")}</Text></View>
      <Text style={styles.sectionLabel}>{t("LER E ACOMPANHAR")}</Text>
      <View style={styles.featuredRow}>
        <Tile destaque icon="book-outline" titulo={t("Bíblia")} legenda={t("Leia por livro e capítulo")} onPress={() => router.navigate("/biblia")} styles={styles} colors={colors} />
        <Tile destaque icon="library-outline" titulo={t("Planos de leitura")} legenda={t("Escolha sua jornada diária")} onPress={() => router.navigate("/devocional-planos")} styles={styles} colors={colors} />
      </View>
      <View style={styles.divider}><View style={styles.dividerLine} /><Ionicons name="sparkles-outline" size={15} color={colors.primary} /><View style={styles.dividerLine} /></View>
      <Text style={styles.sectionLabel}>{t("GUARDAR E REVISITAR")}</Text>
      <View style={styles.grid}>
        <Tile icon="chatbubbles-outline" titulo={t("Comentários")} legenda={t("Converse com sua comunidade")} onPress={() => router.navigate("/devocional-mural")} styles={styles} colors={colors} />
        <Tile icon="bookmark-outline" titulo={t("Anotações e Marcações")} legenda={t("O que você guardou da Palavra")} onPress={() => router.navigate("/devocional-registros")} styles={styles} colors={colors} />
        <Tile icon="stats-chart-outline" titulo={t("Leituras da Bíblia")} legenda={t("Seu ritmo e planos concluídos")} onPress={() => router.navigate("/devocional-leituras")} styles={styles} colors={colors} largo />
      </View>
      <View style={styles.divider}><View style={styles.dividerLine} /><Ionicons name="compass-outline" size={15} color={colors.primary} /><View style={styles.dividerLine} /></View>
      <Text style={styles.sectionLabel}>{t("PLANOS SUGERIDOS")}</Text>
      {falhou && !planos
        ? <Pressable onPress={carregar} style={styles.erroBox} accessibilityRole="button"><Ionicons name="cloud-offline-outline" size={18} color={colors.textMuted} /><Text style={styles.erroTxt}>{t("Não foi possível carregar os planos.")}</Text><Text style={styles.erroRetry}>{t("Tentar de novo")}</Text></Pressable>
        : !planos
          ? <ActivityIndicator color={colors.primary} style={{ marginVertical: 24 }} />
          : planos.length === 0
            ? <Text style={styles.vazioTxt}>{t("Nenhum plano aberto para inscrição no momento.")}</Text>
            : <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.carrossel} style={styles.carrosselWrap}>
              {planos.map((p) => <PlanoCard key={p.id} plano={p} onPress={() => abrirPlano(p)} styles={styles} colors={colors} t={t} />)}
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
function Tile({ icon, titulo, legenda, onPress, styles, colors, destaque, largo }: { icon: Icone; titulo: string; legenda: string; onPress: () => void; styles: any; colors: any; destaque?: boolean; largo?: boolean }) {
  return <Pressable onPress={onPress} style={({ pressed }) => [styles.tile, destaque && styles.tileFeatured, largo && styles.tileWide, pressed && styles.pressed]} accessibilityRole="button">
    <View style={[styles.icon, destaque && styles.iconFeatured]}><Ionicons name={icon} size={destaque ? 26 : 23} color={destaque ? "#fff" : colors.primary} /></View>
    <View style={styles.tileText}><Text style={[styles.tileTitle, destaque && styles.tileTitleFeatured]}>{titulo}</Text><Text style={[styles.tileCaption, destaque && styles.tileCaptionFeatured]}>{legenda}</Text></View>
    {largo && <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />}
  </Pressable>;
}
const css = (c: any) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.background }, content: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 72 },
  intro: { marginBottom: 28 }, eyebrow: { color: c.primary, fontSize: 11, fontWeight: "800", letterSpacing: 1.5, marginBottom: 7 }, title: { color: c.text, fontSize: 34, fontWeight: "900", letterSpacing: -.6 }, subtitle: { color: c.textMuted, fontSize: 15, lineHeight: 22, marginTop: 6, maxWidth: 310 },
  sectionLabel: { color: c.textMuted, fontSize: 10, fontWeight: "800", letterSpacing: 1.4, marginBottom: 10 }, featuredRow: { flexDirection: "row", gap: 11 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 11 }, tile: { width: "48%", minHeight: 154, backgroundColor: c.surface, borderRadius: 20, padding: 16, borderWidth: 1, borderColor: c.border, justifyContent: "space-between" },
  tileFeatured: { minHeight: 184, backgroundColor: c.primary, borderColor: c.primary }, tileWide: { width: "100%", minHeight: 92, flexDirection: "row", alignItems: "center", justifyContent: "flex-start", gap: 13 },
  icon: { width: 42, height: 42, borderRadius: 14, backgroundColor: c.background, alignItems: "center", justifyContent: "center" }, iconFeatured: { backgroundColor: "rgba(255,255,255,.18)" },
  tileText: { flexShrink: 1 }, tileTitle: { color: c.text, fontSize: 16, fontWeight: "800", lineHeight: 20 }, tileTitleFeatured: { color: "#fff", fontSize: 18 },
  tileCaption: { color: c.textMuted, fontSize: 12, lineHeight: 17, marginTop: 5 }, tileCaptionFeatured: { color: "rgba(255,255,255,.82)" },
  divider: { flexDirection: "row", alignItems: "center", gap: 9, marginVertical: 23 }, dividerLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: c.border }, pressed: { opacity: .72, transform: [{ scale: .985 }] },
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
