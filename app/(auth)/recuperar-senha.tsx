import { Text } from "@/components/ui/Typography";
import { useMemo, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { Link, useRouter } from "expo-router";
import { useAuth } from "@/contexts/AuthContext";
import { desfechoRecuperar, guardarCpfSemConta, mensagemErroRecuperar, motivoErroRecuperar } from "@/lib/recuperarSenhaRegra";
import { trackEventoJa } from "@/lib/telemetria";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { CbrioHeart } from "@/components/brand/CbrioHeart";
import { apiPost } from "@/lib/api";
import { mascararCpf, soDigitosCpf } from "@/lib/cpf";
import { useColors } from "@/contexts/ThemeContext";
import { useT } from "@/lib/i18n";
import { font, radius, spacing, type Palette } from "@/constants/theme";
import { TecladoSeguro } from "@/components/ui/TecladoSeguro";

export default function RecuperarSenhaScreen() {
  const [emailMascarado, setEmailMascarado] = useState<string | null>(null);
  const t = useT();
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [cpf, setCpf] = useState("");
  const [email, setEmail] = useState("");
  const [confirmarEmail, setConfirmarEmail] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [semConta, setSemConta] = useState(false);
  const { user } = useAuth();
  const router = useRouter();

  async function handleReset() {
    setError(null);
    setSemConta(false);
    if (loading) return;
    if (soDigitosCpf(cpf).length !== 11) {
      setError(t("Informe um CPF válido."));
      return;
    }
    if (confirmarEmail && !email.trim()) {
      setError(t("Informe um e-mail válido."));
      return;
    }
    setLoading(true);
    try {
      const response = await apiPost<{ emailMascarado: string | null; semConta?: boolean }>("/app/auth/recuperar-senha", {
        cpf: soDigitosCpf(cpf),
        ...(confirmarEmail ? { email: email.trim() } : {}),
      }, { auth: false });
      const desfecho = desfechoRecuperar(response);
      trackEventoJa("recuperar_senha", { reason: desfecho, source: user ? "configuracoes" : "login" });
      if (desfecho === "sem_conta") {
        // CPF que nunca teve conta (27/11/2026): não existe e-mail para esperar.
        // Quem está fora do app vai criar a conta, com o CPF já preenchido.
        // Quem abriu por Configurações já está dentro: só o aviso.
        if (user) {
          setSemConta(true);
        } else {
          guardarCpfSemConta(soDigitosCpf(cpf));
          router.replace("/(auth)/cadastro");
        }
        return;
      }
      setEmailMascarado(response.emailMascarado);
      setSent(true);
    } catch (e) {
      // ⚠️ Nunca o texto do servidor nem o erro de rede cru (lib/recuperarSenhaRegra.ts).
      trackEventoJa("recuperar_senha", { reason: motivoErroRecuperar(e), source: user ? "configuracoes" : "login" });
      setError(t(mensagemErroRecuperar(e)));
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <TecladoSeguro        style={styles.flex}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
          contentContainerStyle={styles.scroll}>
          <View style={styles.card}>
            <View style={styles.logoCircle}>
              <CbrioHeart size={40} color={colors.brandPale} />
            </View>
            <Text style={styles.title}>{t("Recuperar senha")}</Text>
            <Text style={styles.subtitle}>
              {t("Informe seu CPF para receber um link no e-mail da sua conta.")}
            </Text>

            {sent ? (
              <View style={styles.form}>
              <Text style={styles.success}>
                {emailMascarado ? `${t("Link enviado para")} ${emailMascarado}. ${t("Confira também a pasta de spam.")}` : t("Se houver uma conta vinculada ao CPF, você receberá as instruções no e-mail cadastrado.")}
              </Text>
              <Text style={styles.subtitle}>{t("Não recebeu o link?")}</Text>
              <Button title={t("Confirmar e-mail da conta")} variant="ghost" onPress={() => {
                setConfirmarEmail(true);
                setSent(false);
                setError(null);
                setEmailMascarado(null);
              }} />
              </View>
            ) : (
              <View style={styles.form}>
                <Input
                  label={t("CPF")}
                  value={cpf}
                  onChangeText={(value) => setCpf(mascararCpf(value))}
                  placeholder="000.000.000-00"
                  keyboardType="number-pad"
                  maxLength={14}
                />
                {confirmarEmail && <>
                  <Text style={styles.subtitle}>{t("Confirme o e-mail que você usa para entrar no app. O link será enviado apenas se ele estiver vinculado ao CPF informado.")}</Text>
                  <Input label={t("E-mail")} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoComplete="email" maxLength={254} />
                </>}
                {semConta && <Text style={styles.error}>{t("Este CPF ainda não tem conta no app.")}</Text>}
                {error && <Text style={styles.error}>{error}</Text>}
                <Button title={t("Enviar link")} onPress={handleReset} loading={loading} />
              </View>
            )}
          </View>

          <View style={styles.footer}>
            <Link href="/(auth)/login" style={styles.footerLink}>
              {t("Voltar para o login")}
            </Link>
          </View>
        </ScrollView>
      </TecladoSeguro>
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
    textAlign: "center",
  },
  form: { width: "100%", gap: spacing.md },
  error: { color: colors.danger, fontSize: font.size.sm },
  success: { color: colors.success, fontSize: font.size.md, lineHeight: 22 },
  footer: { alignItems: "center" },
  footerLink: {
    color: colors.brandMid,
    fontSize: font.size.md,
    fontWeight: "700",
  },
});
