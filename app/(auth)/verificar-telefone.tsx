import { useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "@/components/ui/Button";
import { CodeInput } from "@/components/ui/CodeInput";
import { CbrioHeart } from "@/components/brand/CbrioHeart";
import { useAuth } from "@/contexts/AuthContext";
import { useColors } from "@/contexts/ThemeContext";
import { useT } from "@/lib/i18n";
import { font, radius, spacing, type Palette } from "@/constants/theme";

export default function VerificarTelefoneScreen() {
  const { phone } = useLocalSearchParams<{ phone: string }>();
  const { verifyPhoneOtp, resendPhoneOtp } = useAuth();
  const t = useT();
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleVerify(submitted?: string) {
    const value = submitted ?? code;
    setError(null);
    setInfo(null);
    if (value.length < 6) {
      setError(t("Digite os 6 dígitos recebidos por SMS."));
      return;
    }
    setLoading(true);
    try {
      await verifyPhoneOtp(phone ?? "", value);
      // O guard de rotas redireciona para a área autenticada.
    } catch (e) {
      setError(e instanceof Error ? e.message : t("Código inválido."));
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    setError(null);
    setInfo(null);
    try {
      await resendPhoneOtp(phone ?? "");
      setInfo(t("Enviamos um novo código por SMS."));
    } catch (e) {
      setError(e instanceof Error ? e.message : t("Não foi possível reenviar."));
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.card}>
            <View style={styles.logoCircle}>
              <CbrioHeart size={40} color={colors.brandPale} />
            </View>
            <Text style={styles.title}>{t("Confirme seu número")}</Text>
            <Text style={styles.subtitle}>
              {t("Enviamos um código por SMS para")} {phone}
            </Text>

            <View style={styles.form}>
              <CodeInput
                value={code}
                onChangeText={setCode}
                cellCount={6}
                onFilled={(value) => handleVerify(value)}
              />

              {error && <Text style={styles.error}>{error}</Text>}
              {info && <Text style={styles.info}>{info}</Text>}

              <Button
                title={t("Confirmar")}
                onPress={() => handleVerify()}
                loading={loading}
              />
              <Button
                title={t("Reenviar código")}
                variant="ghost"
                onPress={handleResend}
              />
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  scroll: {
    flexGrow: 1,
    padding: spacing.lg,
    justifyContent: "center",
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    padding: spacing.xl,
    alignItems: "center",
  },
  logoCircle: {
    width: 64,
    height: 64,
    borderRadius: radius.full,
    backgroundColor: colors.glass,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  title: { color: colors.text, fontSize: font.size.xl, fontWeight: "800" },
  subtitle: {
    color: colors.textMuted,
    fontSize: font.size.md,
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
    textAlign: "center",
  },
  form: { width: "100%", gap: spacing.md },
  error: { color: colors.danger, fontSize: font.size.sm },
  info: { color: colors.success, fontSize: font.size.sm },
});
