import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useColors } from "@/contexts/ThemeContext";
import { font, radius, spacing, type Palette } from "@/constants/theme";

type Props = {
  title: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  description?: string;
};

/** Tela placeholder para módulos ainda não construídos. */
export function ComingSoon({ title, icon, description }: Props) {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.content}>
        <View style={styles.badge}>
          <Ionicons name={icon} size={36} color={colors.brandPale} />
        </View>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.note}>
          {description ?? "Este módulo está a caminho. Em breve por aqui. 💙"}
        </Text>
      </View>
    </SafeAreaView>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    content: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      padding: spacing.lg,
      gap: spacing.md,
    },
    badge: {
      width: 88,
      height: 88,
      borderRadius: radius.full,
      backgroundColor: colors.glass,
      borderWidth: 1,
      borderColor: colors.glassBorder,
      alignItems: "center",
      justifyContent: "center",
    },
    title: { color: colors.text, fontSize: font.size.xl, fontWeight: "800" },
    note: {
      color: colors.textMuted,
      fontSize: font.size.md,
      textAlign: "center",
      lineHeight: 22,
    },
  });
