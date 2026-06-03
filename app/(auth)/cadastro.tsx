import { useMemo, useState } from "react";
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
import { PhoneInput } from "@/components/ui/PhoneInput";
import { CbrioHeart } from "@/components/brand/CbrioHeart";
import { useAuth } from "@/contexts/AuthContext";
import { useColors } from "@/contexts/ThemeContext";
import { DEFAULT_COUNTRY, type Country } from "@/constants/countries";
import {
  dateBRToISO,
  isValidCPF,
  isValidDateBR,
  maskCPF,
  maskDateBR,
  onlyDigits,
} from "@/lib/validators";
import { font, radius, spacing, type Palette } from "@/constants/theme";

export default function CadastroScreen() {
  const { signUp } = useAuth();
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const router = useRouter();
  const [nome, setNome] = useState("");
  const [cpf, setCpf] = useState("");
  const [nascimento, setNascimento] = useState("");
  const [country, setCountry] = useState<Country>(DEFAULT_COUNTRY);
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSignUp() {
    setError(null);
    if (!nome || !cpf || !nascimento || !phone || !email || !password) {
      setError("Preencha todos os campos.");
      return;
    }
    if (!isValidCPF(cpf)) {
      setError("CPF inválido.");
      return;
    }
    if (!isValidDateBR(nascimento)) {
      setError("Data de nascimento inválida (use DD/MM/AAAA).");
      return;
    }
    if (password.length < 6) {
      setError("A senha deve ter pelo menos 6 caracteres.");
      return;
    }
    setLoading(true);
    try {
      const { needsEmailConfirmation } = await signUp(email, password, {
        nome,
        cpf: onlyDigits(cpf),
        dataNascimento: dateBRToISO(nascimento)!,
        telefone: `+${country.dial}${onlyDigits(phone)}`,
      });
      if (needsEmailConfirmation) {
        Alert.alert(
          "Confirme seu e-mail",
          "Enviamos um link de confirmação para o seu e-mail. Confirme para entrar.",
          [{ text: "OK", onPress: () => router.replace("/(auth)/login") }]
        );
      }
      // Com a sessão criada, o guard de rotas leva direto para a área logada.
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível criar a conta.");
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
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.card}>
            <View style={styles.logoCircle}>
              <CbrioHeart size={40} color={colors.brandPale} />
            </View>
            <Text style={styles.title}>Criar conta</Text>
            <Text style={styles.subtitle}>Faça parte da comunidade CBRio</Text>

            <View style={styles.form}>
              <Input
                label="Nome completo"
                value={nome}
                onChangeText={setNome}
                placeholder="Seu nome completo"
                autoCapitalize="words"
              />
              <Input
                label="CPF"
                value={cpf}
                onChangeText={(t) => setCpf(maskCPF(t))}
                placeholder="000.000.000-00"
                keyboardType="number-pad"
                maxLength={14}
              />
              <Input
                label="Data de nascimento"
                value={nascimento}
                onChangeText={(t) => setNascimento(maskDateBR(t))}
                placeholder="DD/MM/AAAA"
                keyboardType="number-pad"
                maxLength={10}
              />
              <PhoneInput
                label="Celular"
                country={country}
                onChangeCountry={setCountry}
                number={phone}
                onChangeNumber={setPhone}
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

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
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
  },
  form: { width: "100%", gap: spacing.md },
  error: { color: colors.danger, fontSize: font.size.sm },
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
