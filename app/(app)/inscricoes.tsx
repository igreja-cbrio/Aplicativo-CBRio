import { useCallback, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Stack, useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useColors } from "@/contexts/ThemeContext";
import { useMembro } from "@/lib/useMembro";
import { carregarStatusInscricoes, type InscricoesStatus, type StatusInscricao } from "@/lib/inscricoesStatus";
import { useT } from "@/lib/i18n";
import { font, radius, spacing, type Palette } from "@/constants/theme";

type Chave = keyof InscricoesStatus;

type Item = {
  label: string;
  desc: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  href: "/batismo" | "/grupos" | "/next" | "/voluntariado";
  chave: Chave;
};

const ITENS: Item[] = [
  { label: "Batismo", desc: "Acompanhe seu batismo na CBRio", icon: "water", href: "/batismo", chave: "batismo" },
  { label: "Grupos", desc: "Participe de um grupo", icon: "people", href: "/grupos", chave: "grupos" },
  { label: "NEXT", desc: "O começo da jornada", icon: "sparkles", href: "/next", chave: "next" },
  { label: "Voluntariado", desc: "Sirva na CBRio", icon: "hand-left", href: "/voluntariado", chave: "voluntariado" },
];

function StatusBadge({ status, styles, colors, t }: { status: StatusInscricao; styles: ReturnType<typeof makeStyles>; colors: Palette; t: (s: string) => string }) {
  if (status === "nenhum") return null;
  const ativo = status === "ativo";
  return (
    <View style={[styles.badge, { backgroundColor: ativo ? "rgba(63,166,107,0.16)" : "rgba(245,158,11,0.16)" }]}>
      <View style={[styles.badgeDot, { backgroundColor: ativo ? "#3FA66B" : "#F59E0B" }]} />
      <Text style={[styles.badgeTxt, { color: ativo ? "#3FA66B" : "#F59E0B" }]}>
        {ativo ? t("Inscrito") : t("Pendente")}
      </Text>
    </View>
  );
}

export default function InscricoesScreen() {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const router = useRouter();
  const t = useT();
  const { membro } = useMembro();
  const [status, setStatus] = useState<InscricoesStatus | null>(null);

  useFocusEffect(
    useCallback(() => {
      carregarStatusInscricoes(membro?.membroId ?? null).then(setStatus).catch(() => {});
    }, [membro?.membroId])
  );

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.topRow}>
          <Pressable onPress={() => router.back()} hitSlop={8} style={styles.back} accessibilityRole="button" accessibilityLabel={t("Voltar")}>
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </Pressable>
          <Text style={styles.title}>{t("Inscrições")}</Text>
          <View style={{ width: 24 }} />
        </View>

        {ITENS.map((it) => {
          const st = status?.[it.chave] ?? "nenhum";
          return (
            <Pressable
              key={it.href}
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
              onPress={() => router.navigate(it.href)}
              accessibilityRole="button"
              accessibilityLabel={`${t(it.label)}. ${st === "ativo" ? t("Inscrito") : st === "pendente" ? t("Pendente") : t(it.desc)}`}
            >
              <View style={styles.icon}>
                <Ionicons name={it.icon} size={22} color={colors.brandMid} />
              </View>
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={styles.rowLabel}>{t(it.label)}</Text>
                <Text style={styles.rowDesc}>{t(it.desc)}</Text>
              </View>
              <StatusBadge status={st} styles={styles} colors={colors} t={t} />
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </Pressable>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    content: { padding: spacing.lg, paddingBottom: 120, gap: spacing.md },
    topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: spacing.sm, marginBottom: spacing.sm },
    back: { width: 24 },
    title: { color: colors.text, fontSize: font.size.lg, fontWeight: "800" },
    row: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.glassBorder, padding: spacing.lg },
    pressed: { opacity: 0.7 },
    icon: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.glass, alignItems: "center", justifyContent: "center" },
    rowLabel: { color: colors.text, fontSize: font.size.md, fontWeight: "700" },
    rowDesc: { color: colors.textMuted, fontSize: font.size.sm },
    badge: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 9, paddingVertical: 4, borderRadius: radius.full },
    badgeDot: { width: 6, height: 6, borderRadius: 3 },
    badgeTxt: { fontSize: 11, fontWeight: "700" },
  });
