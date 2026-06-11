import { useMemo } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Stack, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "@/components/ui/Button";
import { useColors } from "@/contexts/ThemeContext";
import { useT } from "@/lib/i18n";
import { font, radius, spacing, type Palette } from "@/constants/theme";

type Props = {
  title: string;
  subtitle?: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  submitLabel: string;
  onSubmit: () => void;
  submitting?: boolean;
  enviado: boolean;
  enviadoTexto?: string;
  /** Quando preenchido, mostra um aviso de "bloqueado" no lugar do formulário. */
  bloqueadoTexto?: string;
  error?: string | null;
  children: React.ReactNode;
};

export function FormScaffold({
  title,
  subtitle,
  icon,
  submitLabel,
  onSubmit,
  submitting,
  enviado,
  enviadoTexto,
  bloqueadoTexto,
  error,
  children,
}: Props) {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const router = useRouter();
  const t = useT();

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <Stack.Screen options={{ headerShown: false }} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.topRow}>
            <Pressable onPress={() => router.back()} hitSlop={8} style={styles.back}>
              <Ionicons name="chevron-back" size={24} color={colors.text} />
            </Pressable>
            <Text style={styles.title}>{title}</Text>
            <View style={{ width: 24 }} />
          </View>

          {bloqueadoTexto ? (
            <View style={styles.card}>
              <Ionicons name="lock-closed-outline" size={40} color={colors.textMuted} />
              <Text style={styles.okTitle}>{t("Inscrições fechadas")}</Text>
              <Text style={styles.okText}>{bloqueadoTexto}</Text>
              <Button title={t("Voltar")} variant="ghost" onPress={() => router.back()} />
            </View>
          ) : enviado ? (
            <View style={styles.card}>
              <Ionicons name="checkmark-circle" size={40} color={colors.success} />
              <Text style={styles.okTitle}>{t("Inscrição enviada!")}</Text>
              <Text style={styles.okText}>
                {enviadoTexto ?? t("Recebemos sua inscrição. Em breve falamos com você. 💙")}
              </Text>
              <Button title={t("Voltar")} variant="ghost" onPress={() => router.back()} />
            </View>
          ) : (
            <>
              <View style={styles.header}>
                <View style={styles.badge}>
                  <Ionicons name={icon} size={26} color={colors.brandPale} />
                </View>
                {!!subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
              </View>
              <View style={styles.form}>
                {children}
                {error && <Text style={styles.error}>{error}</Text>}
                <Button title={submitLabel} onPress={onSubmit} loading={submitting} />
              </View>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    flex: { flex: 1 },
    content: { padding: spacing.lg, paddingBottom: 120, gap: spacing.lg },
    topRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginTop: spacing.sm,
    },
    back: { width: 24 },
    title: { color: colors.text, fontSize: font.size.lg, fontWeight: "800" },
    header: { alignItems: "center", gap: spacing.sm },
    badge: {
      width: 64,
      height: 64,
      borderRadius: radius.full,
      backgroundColor: colors.glass,
      borderWidth: 1,
      borderColor: colors.glassBorder,
      alignItems: "center",
      justifyContent: "center",
    },
    subtitle: {
      color: colors.textMuted,
      fontSize: font.size.md,
      textAlign: "center",
      lineHeight: 22,
    },
    form: { gap: spacing.md },
    error: { color: colors.danger, fontSize: font.size.sm },
    card: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.glassBorder,
      padding: spacing.lg,
      alignItems: "center",
      gap: spacing.sm,
    },
    okTitle: { color: colors.text, fontSize: font.size.lg, fontWeight: "800" },
    okText: { color: colors.textMuted, fontSize: font.size.md, textAlign: "center", lineHeight: 22 },
  });
