// Casca das 4 telas-filha da KIDS: header (seta + título), loading, erro+retry,
// pull-to-refresh e estado vazio gentil. Cada tela só diz o que desenhar.
import { ScrollView } from "@/components/navigation/DockContent";
import { Text } from "@/components/ui/Typography";
import { useMemo } from "react";
import { ActivityIndicator, Pressable, RefreshControl, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useColors } from "@/contexts/ThemeContext";
import { useT } from "@/lib/i18n";
import { subirUmNivel } from "@/lib/hierarquia";
import { ErrorState } from "@/components/ui/ErrorState";
import { font, radius, spacing, type Palette } from "@/constants/theme";
import { ROSA, useKidsArea, type KidsArea } from "@/lib/kidsArea";

export function KidsSecao({ rota, titulo, vazio, itens, acaoCabecalho, antesDosItens }: {
  acaoCabecalho?: React.ReactNode;
  antesDosItens?: (area: KidsArea) => React.ReactNode;
  rota: string;
  titulo: string;
  vazio: string;
  itens: (area: KidsArea) => React.ReactNode[];
}) {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const t = useT();
  const { area, carregando, refreshing, falhou, recarregar, tentarDeNovo } = useKidsArea();
  const lista = area ? itens(area) : [];

  return (
    <SafeAreaView style={styles.safe} edges={["left", "right"]}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={recarregar} tintColor={colors.brandMid} />}
      >
        <View style={styles.header}>
          <Pressable onPress={() => subirUmNivel(rota)} hitSlop={8} style={styles.back} accessibilityRole="button" accessibilityLabel={t("Voltar")}>
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </Pressable>
          <Text style={styles.title}>{titulo}</Text>
          {acaoCabecalho || <View style={{ width: 24 }} />}
        </View>

        {area && antesDosItens?.(area)}
        {carregando ? (
          <View style={styles.center}><ActivityIndicator color={colors.brandMid} /></View>
        ) : falhou && !area ? (
          <ErrorState onRetry={tentarDeNovo} />
        ) : lista.length === 0 ? (
          <Text style={styles.vazio}>{vazio}</Text>
        ) : (
          lista
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

export const makeCardStyles = (colors: Palette, destaque = ROSA) =>
  StyleSheet.create({
    card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.glassBorder, borderRadius: radius.lg, padding: spacing.lg, gap: 4 },
    cardDestaque: { borderColor: destaque, borderWidth: 2 },
    selo: { color: destaque, fontSize: font.size.sm, fontWeight: "800" },
    cardTitulo: { color: colors.text, fontSize: font.size.md, fontWeight: "800" },
    cardCorpo: { color: colors.textMuted, fontSize: font.size.md, lineHeight: 22, marginTop: 2 },
    meta: { color: colors.brandMid, fontSize: font.size.sm, fontWeight: "700" },
    salaRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
    salaLogo: { width: 40, height: 40, borderRadius: 8 },
    bolinha: { width: 14, height: 14, borderRadius: 7 },
  });

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    content: { padding: spacing.lg, paddingBottom: 40, gap: spacing.md },
    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm, marginBottom: spacing.sm },
    back: { width: 24 },
    title: { flex: 1, textAlign: "center", color: colors.text, fontSize: font.size.lg, fontWeight: "800" },
    center: { alignItems: "center", paddingVertical: spacing.xl },
    vazio: { color: colors.textMuted, fontSize: font.size.md, textAlign: "center", paddingVertical: spacing.xl },
  });
