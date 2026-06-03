import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Link } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useAuth } from "@/contexts/AuthContext";
import { colors, font, spacing } from "@/constants/theme";

export default function RecuperarSenhaScreen() {
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleReset() {
    setError(null);
    if (!email) {
      setError("Informe seu e-mail.");
      return;
    }
    setLoading(true);
    try {
      await resetPassword(email);
      setSent(true);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Não foi possível enviar o e-mail."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <Text style={styles.title}>Recuperar senha</Text>
            <Text style={styles.subtitle}>
              Enviaremos um link para redefinir sua senha.
            </Text>
          </View>

          {sent ? (
            <Text style={styles.success}>
              Pronto! Se houver uma conta com esse e-mail, o link de
              recuperação foi enviado.
            </Text>
          ) : (
            <View style={styles.form}>
              <Input
                label="E-mail"
                value={email}
                onChangeText={setEmail}
                placeholder="voce@exemplo.com"
                keyboardType="email-address"
              />
              {error && <Text style={styles.error}>{error}</Text>}
              <Button
                title="Enviar link"
                onPress={handleReset}
                loading={loading}
              />
            </View>
          )}

          <View style={styles.footer}>
            <Link href="/(auth)/login" style={styles.footerLink}>
              Voltar para o login
            </Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  content: {
    flexGrow: 1,
    padding: spacing.lg,
    justifyContent: "center",
    gap: spacing.xl,
  },
  header: { gap: spacing.xs },
  title: { color: colors.text, fontSize: font.size.xl, fontWeight: "800" },
  subtitle: { color: colors.textMuted, fontSize: font.size.md },
  form: { gap: spacing.md },
  error: { color: colors.danger, fontSize: font.size.sm },
  success: { color: colors.success, fontSize: font.size.md, lineHeight: 22 },
  footer: { alignItems: "center" },
  footerLink: {
    color: colors.primary,
    fontSize: font.size.md,
    fontWeight: "700",
  },
});
