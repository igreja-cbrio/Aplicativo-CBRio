import { useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Stack, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useColors } from "@/contexts/ThemeContext";
import { font, radius, spacing, type Palette } from "@/constants/theme";

type Item = {
  label: string;
  desc: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  href: "/batismo" | "/grupos" | "/next" | "/voluntariado";
};

const ITENS: Item[] = [
  { label: "Batismo", desc: "Acompanhe seu batismo na CBRio", icon: "water", href: "/batismo" },
  { label: "Grupos", desc: "Participe de um grupo", icon: "people", href: "/grupos" },
  { label: "NEXT", desc: "O começo da jornada", icon: "sparkles", href: "/next" },
  { label: "Voluntariado", desc: "Sirva na CBRio", icon: "hand-left", href: "/voluntariado" },
];

export default function InscricoesScreen() {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.topRow}>
          <Pressable onPress={() => router.back()} hitSlop={8} style={styles.back}>
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </Pressable>
          <Text style={styles.title}>Inscrições</Text>
          <View style={{ width: 24 }} />
        </View>

        {ITENS.map((it) => (
          <Pressable
            key={it.href}
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            onPress={() => router.navigate(it.href)}
          >
            <View style={styles.icon}>
              <Ionicons name={it.icon} size={22} color={colors.brandMid} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowLabel}>{it.label}</Text>
              <Text style={styles.rowDesc}>{it.desc}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </Pressable>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    content: { padding: spacing.lg, paddingBottom: 120, gap: spacing.md },
    topRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginTop: spacing.sm,
      marginBottom: spacing.sm,
    },
    back: { width: 24 },
    title: { color: colors.text, fontSize: font.size.lg, fontWeight: "800" },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.glassBorder,
      padding: spacing.lg,
    },
    pressed: { opacity: 0.7 },
    icon: {
      width: 44,
      height: 44,
      borderRadius: radius.md,
      backgroundColor: colors.glass,
      alignItems: "center",
      justifyContent: "center",
    },
    rowLabel: { color: colors.text, fontSize: font.size.md, fontWeight: "700" },
    rowDesc: { color: colors.textMuted, fontSize: font.size.sm },
  });
