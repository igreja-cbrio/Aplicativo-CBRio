import { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Link, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useAuth } from "@/contexts/AuthContext";
import { colors, font, spacing } from "@/constants/theme";

export default function CadastroScreen() {
  const { signUp } = useAuth();
  const router = useRouter();
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSignUp() {
    setError(null);
    if (!nome || !email || !password) {
      setError("Preencha todos os campos.");
      return;
    }
    if (password.length < 6) {
      setError("A senha deve ter pelo menos 6 caracteres.");
      return;
    }
    setLoading(true);
    try {
      const { needsConfirmation } = await signUp(email, password, nome);
      if (needsConfirmation) {
        Alert.alert(
          "Confirme seu e-mail",
          "Enviamos um link de confirmação. Verifique sua caixa de entrada para ativar a conta."
        );
        router.replace("/(auth)/login");
      }
      // Se já houver sessão, o guard de rotas redireciona automaticamente.
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Não foi possível criar a conta."
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
            <Text style={styles.title}>Criar conta</Text>
            <Text style={styles.subtitle}>Faça parte da comunidade CBRio</Text>
          </View>

          <View style={styles.form}>
            <Input
              label="Nome completo"
              value={nome}
              onChangeText={setNome}
              placeholder="Seu nome"
              autoCapitalize="words"
            />
            <Input
              label="E-mail"
              value={email}
              onChangeText={setEmail}
              placeholder="voce@exemplo.com"
              keyboardType="email-address"
            />
            <Input
              label="Senha"
              value={password}
              onChangeText={setPassword}
              placeholder="Mínimo 6 caracteres"
              secure
            />

            {error && <Text style={styles.error}>{error}</Text>}

            <Button
              title="Criar conta"
              onPress={handleSignUp}
              loading={loading}
            />
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Já tem conta?</Text>
            <Link href="/(auth)/login" style={styles.footerLink}>
              Entrar
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
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    gap: spacing.xs,
  },
  footerText: { color: colors.textMuted, fontSize: font.size.md },
  footerLink: {
    color: colors.primary,
    fontSize: font.size.md,
    fontWeight: "700",
  },
});
