// KIDS — menu do membro. Cada item abre a sua tela (o check-in vive em /kids).
// Não carrega dados: só navega.
import { ScrollView } from "@/components/navigation/DockContent";
import { Text } from "@/components/ui/Typography";
import { useMemo } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, router, type Href } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useColors } from "@/contexts/ThemeContext";
import { useT } from "@/lib/i18n";
import { subirUmNivel } from "@/lib/hierarquia";
import { font, radius, spacing, type Palette } from "@/constants/theme";

const ROSA = "#E85D9A";

type Item = { rota: Href; icone: keyof typeof Ionicons.glyphMap; titulo: string; sub: string; destaque?: boolean };

export default function KidsAreaScreen() {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const t = useT();

  const itens: Item[] = [
    { rota: "/kids", icone: "happy-outline", titulo: t("Minhas crianças"), sub: t("Check-in, fichas e avisos dos seus filhos."), destaque: true },
    { rota: "/kids-mural", icone: "megaphone-outline", titulo: t("Mural de avisos"), sub: t("Recados da equipe do Kids.") },
    { rota: "/kids-eventos", icone: "calendar-outline", titulo: t("Fique por dentro"), sub: t("Próximos eventos e novidades.") },
    { rota: "/kids-horarios", icone: "time-outline", titulo: t("Horários de funcionamento"), sub: t("Quando o Kids está aberto.") },
    { rota: "/kids-salas", icone: "grid-outline", titulo: t("Divisão das salas"), sub: t("Qual sala é de cada idade.") },
  ];

  return (
    <SafeAreaView style={styles.safe} edges={["left", "right"]}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Pressable onPress={() => subirUmNivel("/kids-area")} hitSlop={8} style={styles.back} accessibilityRole="button" accessibilityLabel={t("Voltar")}>
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </Pressable>
          <Text style={styles.title}>{t("KIDS")}</Text>
          <View style={{ width: 24 }} />
        </View>

        {itens.map((it) => (
          <Pressable
            key={String(it.rota)}
            onPress={() => router.navigate(it.rota)}
            style={({ pressed }) => [styles.tile, it.destaque && styles.tileDestaque, pressed && { opacity: 0.8 }]}
            accessibilityRole="button"
            accessibilityLabel={it.titulo}
          >
            <View style={[styles.icone, it.destaque && styles.iconeDestaque]}>
              <Ionicons name={it.icone} size={26} color={it.destaque ? "#fff" : ROSA} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.tileTitulo, it.destaque && { color: "#fff" }]}>{it.titulo}</Text>
              <Text style={[styles.tileSub, it.destaque && { color: "#fff" }]}>{it.sub}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={it.destaque ? "#fff" : colors.textMuted} />
          </Pressable>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    content: { padding: spacing.lg, paddingBottom: 40, gap: spacing.md },
    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.sm },
    back: { width: 24 },
    title: { color: colors.text, fontSize: font.size.lg, fontWeight: "800" },
    tile: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.glassBorder, borderRadius: radius.lg, padding: spacing.lg },
    tileDestaque: { backgroundColor: ROSA, borderColor: ROSA },
    icone: { width: 46, height: 46, borderRadius: 23, backgroundColor: "rgba(232,93,154,0.15)", alignItems: "center", justifyContent: "center" },
    iconeDestaque: { backgroundColor: "rgba(255,255,255,0.25)" },
    tileTitulo: { color: colors.text, fontSize: font.size.lg, fontWeight: "800" },
    tileSub: { color: colors.textMuted, fontSize: font.size.sm, marginTop: 2 },
  });
