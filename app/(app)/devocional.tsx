import { useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useColors } from "@/contexts/ThemeContext";
import { useT } from "@/lib/i18n";

type Icone = keyof typeof Ionicons.glyphMap;
export default function DevocionalHome() {
  const colors = useColors(), styles = useMemo(() => css(colors), [colors]), t = useT();
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
    </ScrollView>
  </SafeAreaView>;
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
});
