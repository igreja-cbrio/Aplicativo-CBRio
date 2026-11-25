import { ValorHeader } from "@/components/ui/ValorHeader";
import { Text } from "@/components/ui/Typography";
import { useMemo } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useColors } from "@/contexts/ThemeContext";
import { useT } from "@/lib/i18n";

/**
 * Home do Devocional (enxugada em 25/11/2026 · pedido do Marcos: "muitas opções";
 * a aba NÃO rola, tudo cabe na tela assim que abre).
 * - Minhas anotações e Meu histórico foram para o topo da Bíblia (tela de escolher livro).
 * - Devocional Kids virou "Devocional em família", um dos Planos de leitura.
 * ⚠️ Sem ScrollView de propósito: as duas linhas dividem a altura disponível (flex),
 * então cabem em telas pequenas sem rolar. Não acrescentar quadro novo aqui sem
 * tirar outro.
 */
type Icone = keyof typeof Ionicons.glyphMap;
export default function DevocionalHome() {
  const colors = useColors(), styles = useMemo(() => css(colors), [colors]), t = useT();
  return <SafeAreaView style={styles.safe} edges={["left", "right"]}>
    <Stack.Screen options={{ headerShown: false }} />
    <View style={styles.content}>
      <View style={styles.intro}><ValorHeader style={{ marginBottom: 6 }} /><Text style={styles.subtitle}>{t("Leia, reflita e guarde o que Deus falou com você.")}</Text></View>
      <Text style={styles.sectionLabel}>{t("LER A PALAVRA")}</Text>
      <View style={[styles.row, styles.rowFeatured]}>
        <Tile destaque icon="book-outline" titulo={t("Bíblia")} legenda={t("Leia por livro e capítulo")} onPress={() => router.navigate("/biblia")} styles={styles} colors={colors} />
        <Tile destaque icon="library-outline" titulo={t("Planos de leitura")} legenda={t("Quarta com Deus, família e leituras em grupo")} onPress={() => router.navigate("/devocional-planos")} styles={styles} colors={colors} />
      </View>
      <Text style={[styles.sectionLabel, styles.sectionGap]}>{t("COMUNIDADE")}</Text>
      <View style={styles.row}>
        <Tile icon="chatbubbles-outline" titulo={t("Comentários")} legenda={t("Converse com sua comunidade")} onPress={() => router.navigate("/devocional-mural")} styles={styles} colors={colors} />
        <Tile icon="play-circle-outline" titulo={t("Vídeos e séries")} legenda={t("Conteúdos para assistir")} onPress={() => router.navigate("/conteudos")} styles={styles} colors={colors} />
      </View>
    </View>
  </SafeAreaView>;
}
function Tile({ icon, titulo, legenda, onPress, styles, colors, destaque }: { icon: Icone; titulo: string; legenda: string; onPress: () => void; styles: any; colors: any; destaque?: boolean }) {
  return <Pressable onPress={onPress} style={({ pressed }) => [styles.tile, destaque && styles.tileFeatured, pressed && styles.pressed]} accessibilityRole="button">
    <View style={[styles.icon, destaque && styles.iconFeatured]}><Ionicons name={icon} size={destaque ? 26 : 23} color={destaque ? "#fff" : colors.primary} /></View>
    <View style={styles.tileText}><Text style={[styles.tileTitle, destaque && styles.tileTitleFeatured]}>{titulo}</Text><Text style={[styles.tileCaption, destaque && styles.tileCaptionFeatured]} numberOfLines={2}>{legenda}</Text></View>
  </Pressable>;
}
const css = (c: any) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.background }, content: { flex: 1, paddingHorizontal: 20, paddingTop: 18, paddingBottom: 20 },
  intro: { marginBottom: 20 }, subtitle: { color: c.textMuted, fontSize: 15, lineHeight: 22, marginTop: 6, maxWidth: 310 },
  sectionLabel: { color: c.textMuted, fontSize: 10, fontWeight: "800", letterSpacing: 1.4, marginBottom: 10 }, sectionGap: { marginTop: 20 },
  // As duas linhas dividem a altura que sobra: a de destaque um pouco maior.
  row: { flex: 1, flexDirection: "row", gap: 11, maxHeight: 190 }, rowFeatured: { flex: 1.25, maxHeight: 230 },
  tile: { flex: 1, minHeight: 120, backgroundColor: c.surface, borderRadius: 20, padding: 16, borderWidth: 1, borderColor: c.border, justifyContent: "space-between" },
  tileFeatured: { backgroundColor: c.primary, borderColor: c.primary },
  icon: { width: 42, height: 42, borderRadius: 14, backgroundColor: c.background, alignItems: "center", justifyContent: "center" }, iconFeatured: { backgroundColor: "rgba(255,255,255,.18)" },
  tileText: { flexShrink: 1 }, tileTitle: { color: c.text, fontSize: 16, fontWeight: "800", lineHeight: 20 }, tileTitleFeatured: { color: "#fff", fontSize: 18 },
  tileCaption: { color: c.textMuted, fontSize: 12, lineHeight: 17, marginTop: 5 }, tileCaptionFeatured: { color: "rgba(255,255,255,.82)" },
  pressed: { opacity: .72, transform: [{ scale: .985 }] },
});
