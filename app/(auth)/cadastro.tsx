import { useMemo, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
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
import { useT } from "@/lib/i18n";
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
  const t = useT();
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
  const [frequentaArea, setFrequentaArea] = useState<"ami" | "bridge" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSignUp() {
    setError(null);
    if (!nome || !cpf || !nascimento || !phone || !email || !password) {
      setError(t("Preencha todos os campos."));
      return;
    }
    if (!isValidCPF(cpf)) {
      setError(t("CPF inválido."));
      return;
    }
    if (!isValidDateBR(nascimento)) {
      setError(t("Data de nascimento inválida (use DD/MM/AAAA)."));
      return;
    }
    if (password.length < 6) {
      setError(t("A senha deve ter pelo menos 6 caracteres."));
      return;
    }
    setLoading(true);
    try {
      const { needsEmailConfirmation } = await signUp(email, password, {
        nome,
        cpf: onlyDigits(cpf),
        dataNascimento: dateBRToISO(nascimento)!,
        telefone: `+${country.dial}${onlyDigits(phone)}`,
        frequentaArea,
      });
      if (needsEmailConfirmation) {
        Alert.alert(
          t("Confirme seu e-mail"),
          t("Enviamos um link de confirmação para o seu e-mail. Confirme para entrar."),
          [{ text: "OK", onPress: () => router.replace("/(auth)/login") }]
        );
      }
      // Com a sessão criada, o guard de rotas leva direto para a área logada.
    } catch (e) {
      setError(e instanceof Error ? e.message : t("Não foi possível criar a conta."));
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
            <Text style={styles.title}>{t("Criar conta")}</Text>
            <Text style={styles.subtitle}>{t("Faça parte da comunidade CBRio")}</Text>

            <View style={styles.form}>
              <Input
                label={t("Nome completo")}
                value={nome}
                onChangeText={setNome}
                placeholder={t("Seu nome completo")}
                autoCapitalize="words"
              />
              <Input
                label="CPF"
                value={cpf}
                onChangeText={(v) => setCpf(maskCPF(v))}
                placeholder="000.000.000-00"
                keyboardType="number-pad"
                maxLength={14}
              />
              <Input
                label={t("Data de nascimento")}
                value={nascimento}
                onChangeText={(v) => setNascimento(maskDateBR(v))}
                placeholder="DD/MM/AAAA"
                keyboardType="number-pad"
                maxLength={10}
              />
              <PhoneInput
                label={t("Celular")}
                country={country}
                onChangeCountry={setCountry}
                number={phone}
                onChangeNumber={setPhone}
              />
              <Input
                label={t("E-mail")}
                value={email}
                onChangeText={setEmail}
                placeholder="voce@exemplo.com"
                keyboardType="email-address"
              />
              <Input
                label={t("Senha")}
                value={password}
                onChangeText={setPassword}
                placeholder={t("Mínimo 6 caracteres")}
                secure
              />

              <View style={styles.areaBlock}>
                <Text style={styles.areaLabel}>{t("Você frequenta o AMI ou o Bridge?")}</Text>
                <View style={styles.areaRow}>
                  {([
                    { v: "ami", label: "AMI" },
                    { v: "bridge", label: "Bridge" },
                    { v: null, label: t("Não frequento") },
                  ] as const).map((opt) => {
                    const ativo = frequentaArea === opt.v;
                    return (
                      <Pressable
                        key={opt.label}
                        onPress={() => setFrequentaArea(opt.v)}
                        style={[styles.areaPill, ativo && styles.areaPillOn]}
                        accessibilityRole="button"
                        accessibilityState={{ selected: ativo }}
                      >
                        <Text style={[styles.areaPillTxt, ativo && styles.areaPillTxtOn]}>{opt.label}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              {error && <Text style={styles.error}>{error}</Text>}

              <Button
                title={t("Criar conta")}
                onPress={handleSignUp}
                loading={loading}
              />
            </View>
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>{t("Já tem conta?")}</Text>
            <Link href="/(auth)/login" style={styles.footerLink}>
              {t("Entrar")}
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
  areaBlock: { gap: spacing.xs },
  areaLabel: { color: colors.text, fontSize: font.size.sm, fontWeight: "600" },
  areaRow: { flexDirection: "row", gap: spacing.sm },
  areaPill: {
    flex: 1, paddingVertical: 10, paddingHorizontal: 6, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.glassBorder, backgroundColor: colors.glass,
    alignItems: "center", justifyContent: "center",
  },
  areaPillOn: { backgroundColor: colors.brandMid, borderColor: colors.brandMid },
  areaPillTxt: { color: colors.text, fontSize: font.size.sm, fontWeight: "600", textAlign: "center" },
  areaPillTxtOn: { color: "#ffffff" },
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
