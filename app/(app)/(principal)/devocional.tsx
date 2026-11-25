import { ValorHeader } from "@/components/ui/ValorHeader";
import { ScrollView } from "@/components/navigation/DockContent";
import { Text } from "@/components/ui/Typography";
import { useMemo } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useColors } from "@/contexts/ThemeContext";
import { useT } from "@/lib/i18n";

/**
 * Cards compactos, sem esticar para preencher a tela. Kids tem acesso direto.
 * O scroll preserva o acesso em telas pequenas e com fontes ampliadas.
 */
type Icone = keyof typeof Ionicons.glyphMap;
export default function DevocionalHome() {
  const colors = useColors(), styles = useMemo(() => css(colors), [colors]), t = useT();
  return <SafeAreaView style={styles.safe} edges={["left", "right"]}>
    <Stack.Screen options={{ headerShown: false }} />
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <View style={styles.intro}><ValorHeader style={{ marginBottom: 6 }} /><Text style={styles.subtitle}>{t("Leia, reflita e guarde o que Deus falou com você.")}</Text></View>
      <Text style={styles.sectionLabel}>{t("LER A PALAVRA")}</Text>
      <View style={[styles.row, styles.rowFeatured]}>
        <Tile destaque icon="book-outline" titulo={t("Bíblia")} legenda={t("Leia por livro e capítulo")} onPress={() => router.navigate("/biblia")} styles={styles} colors={colors} />
        <Tile destaque icon="library-outline" titulo={t("Devocional")} legenda={t("Quarta com Deus e leituras em grupo")} onPress={() => router.navigate("/devocional-planos")} styles={styles} colors={colors} />
      </View>
      <Tile destaque horizontal icon="people-outline" titulo={t("Devocional Kids")} legenda={t("Uma semana, uma conversa em família")} onPress={() => router.navigate("/devocional-kids")} styles={styles} colors={colors} />
      <Text style={[styles.sectionLabel, styles.sectionGap]}>{t("COMUNIDADE")}</Text>
      <View style={styles.row}>
        <Tile icon="chatbubbles-outline" titulo={t("Comentários")} legenda={t("Converse com sua comunidade")} onPress={() => router.navigate("/devocional-mural")} styles={styles} colors={colors} />
        <Tile icon="play-circle-outline" titulo={t("Vídeos e séries")} legenda={t("Conteúdos para assistir")} onPress={() => router.navigate("/conteudos")} styles={styles} colors={colors} />
      </View>
    </ScrollView>
  </SafeAreaView>;
}
function Tile({ icon, titulo, legenda, onPress, styles, colors, destaque, horizontal }: { icon: Icone; titulo: string; legenda: string; onPress: () => void; styles: any; colors: any; destaque?: boolean; horizontal?: boolean }) {
  return <Pressable onPress={onPress} style={({ pressed }) => [styles.tile, destaque && styles.tileFeatured, horizontal && styles.tileWide, pressed && styles.pressed]} accessibilityRole="button">
    <View style={[styles.icon, destaque && styles.iconFeatured]}><Ionicons name={icon} size={23} color={destaque ? "#fff" : colors.primary} /></View>
    <View style={[styles.tileText, horizontal && styles.tileTextWide]}><Text style={[styles.tileTitle, destaque && styles.tileTitleFeatured]}>{titulo}</Text><Text style={[styles.tileCaption, destaque && styles.tileCaptionFeatured]} numberOfLines={2}>{legenda}</Text></View>
  </Pressable>;
}
const css = (c: any) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.background }, scroll: { flex: 1 }, content: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 20 },
  intro: { marginBottom: 16 }, subtitle: { color: c.textMuted, fontSize: 15, lineHeight: 22, marginTop: 6, maxWidth: 310 },
  sectionLabel: { color: c.textMuted, fontSize: 10, fontWeight: "800", letterSpacing: 1.4, marginBottom: 10 }, sectionGap: { marginTop: 20 },
  row: { flexDirection: "row", gap: 11, minHeight: 140 }, rowFeatured: { minHeight: 148 },
  tile: { flex: 1, minHeight: 140, backgroundColor: c.surface, borderRadius: 18, padding: 14, borderWidth: 1, borderColor: c.border, justifyContent: "space-between", gap: 14 },
  tileFeatured: { backgroundColor: c.primary, borderColor: c.primary },
  tileWide: { flex: 0, minHeight: 88, flexDirection: "row", alignItems: "center", justifyContent: "flex-start", marginTop: 12 },
  icon: { width: 36, height: 36, borderRadius: 12, backgroundColor: c.background, alignItems: "center", justifyContent: "center" }, iconFeatured: { backgroundColor: "rgba(255,255,255,.18)" },
  tileText: { flexShrink: 1 }, tileTextWide: { flex: 1 }, tileTitle: { color: c.text, fontSize: 16, fontWeight: "800", lineHeight: 20 }, tileTitleFeatured: { color: "#fff", fontSize: 18, lineHeight: 22 },
  tileCaption: { color: c.textMuted, fontSize: 12, lineHeight: 17, marginTop: 5 }, tileCaptionFeatured: { color: "rgba(255,255,255,.82)" },
  pressed: { opacity: .72, transform: [{ scale: .985 }] },
});
