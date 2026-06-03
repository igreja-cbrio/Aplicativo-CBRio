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
import { Checkbox } from "@/components/ui/Checkbox";
import { SocialButton } from "@/components/ui/SocialButton";
import { CbrioHeart } from "@/components/brand/CbrioHeart";
import { useAuth } from "@/contexts/AuthContext";
import { colors, font, radius, spacing } from "@/constants/theme";

export default function LoginScreen() {
  const { signIn, signInWithGoogle, signInWithApple, rememberPref } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(rememberPref);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<null | "email" | "google" | "apple">(
    null
  );

  async function handleLogin() {
    setError(null);
    if (!email || !password) {
      setError("Preencha e-mail e senha.");
      return;
    }
    setLoading("email");
    try {
      await signIn(email, password, remember);
    } catch (e) {
      setError(e instanceof Error ? traduzErro(e.message) : "Não foi possível entrar.");
    } finally {
      setLoading(null);
    }
  }

  async function handleProvider(provider: "google" | "apple") {
    setError(null);
    setLoading(provider);
    try {
      if (provider === "google") await signInWithGoogle();
      else await signInWithApple();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível entrar.");
    } finally {
      setLoading(null);
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
            {/* Header com a logo do coração CBRio */}
            <View style={styles.logoCircle}>
              <CbrioHeart size={44} color={colors.brandPale} strokeWidth={10} />
            </View>
            <Text style={styles.brand}>CBRio</Text>
            <Text style={styles.subtitle}>Bem-vindo de volta</Text>

            <View style={styles.form}>
              <Input
                label="E-mail"
                value={email}
                onChangeText={setEmail}
                placeholder="voce@exemplo.com"
                keyboardType="email-address"
                autoComplete="email"
              />
              <Input
                label="Senha"
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
                secure
                autoComplete="password"
              />

              <View style={styles.rowBetween}>
                <Checkbox
                  checked={remember}
                  onChange={setRemember}
                  label="Lembrar de mim"
                />
                <Link href="/(auth)/recuperar-senha" style={styles.forgot}>
                  Esqueci a senha
                </Link>
              </View>

              {error && <Text style={styles.error}>{error}</Text>}

              <Button
                title="Entrar"
                onPress={handleLogin}
                loading={loading === "email"}
              />

              <View style={styles.dividerRow}>
                <View style={styles.divider} />
                <Text style={styles.dividerText}>ou continue com</Text>
                <View style={styles.divider} />
              </View>

              <SocialButton
                provider="google"
                onPress={() => handleProvider("google")}
                loading={loading === "google"}
              />
              {Platform.OS === "ios" && (
                <SocialButton
                  provider="apple"
                  onPress={() => handleProvider("apple")}
                  loading={loading === "apple"}
                />
              )}
            </View>
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Ainda não tem conta?</Text>
            <Link href="/(auth)/cadastro" style={styles.footerLink}>
              Criar conta
            </Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function traduzErro(msg: string) {
  if (msg.includes("Invalid login credentials"))
    return "E-mail ou senha incorretos.";
  if (msg.includes("Email not confirmed"))
    return "Confirme sua conta antes de entrar.";
  return msg;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  scroll: {
    flexGrow: 1,
    padding: spacing.lg,
    justifyContent: "center",
    gap: spacing.lg,
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
    width: 72,
    height: 72,
    borderRadius: radius.full,
    backgroundColor: colors.glass,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  brand: {
    color: colors.text,
    fontSize: font.size.xxl,
    fontWeight: "800",
    letterSpacing: 1,
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: font.size.md,
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
  },
  form: { width: "100%", gap: spacing.md },
  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  forgot: { color: colors.brandMid, fontSize: font.size.sm, fontWeight: "600" },
  error: { color: colors.danger, fontSize: font.size.sm },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginVertical: spacing.xs,
  },
  divider: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerText: { color: colors.textMuted, fontSize: font.size.sm },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    gap: spacing.xs,
  },
  footerText: { color: colors.textMuted, fontSize: font.size.md },
  footerLink: {
    color: colors.brandMid,
    fontSize: font.size.md,
    fontWeight: "700",
  },
});
