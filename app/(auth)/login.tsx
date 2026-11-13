import { Text } from "@/components/ui/Typography";
import { useMemo, useState } from "react";
import {
  Image,
  Platform,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native";
import { Link, useRouter } from "expo-router";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { LoginHeroVideo } from "@/components/auth/LoginHeroVideo";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Checkbox } from "@/components/ui/Checkbox";
import { SocialButton } from "@/components/ui/SocialButton";
import { StatusBar } from "expo-status-bar";
import { alturaVideoLogin } from "@/lib/loginLayout";
import { useAuth } from "@/contexts/AuthContext";
import { useColors } from "@/contexts/ThemeContext";
import { useT } from "@/lib/i18n";
import { font, radius, spacing, type Palette } from "@/constants/theme";
import { TecladoSeguro } from "@/components/ui/TecladoSeguro";
import { FormularioRolavel } from "@/components/ui/FormularioRolavel";

// Apple Sign-In requer App ID com "Sign in with Apple" (conta paga). Ativado.
const APPLE_SIGNIN_ENABLED = true;

export default function LoginScreen() {
  const { signIn, signInWithGoogle, signInWithApple, rememberPref, enterPreview } =
    useAuth();
  const t = useT();
  const router = useRouter();
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const { height: alturaTela } = useWindowDimensions();
  const [alturaDisponivel, setAlturaDisponivel] = useState(alturaTela - insets.bottom);
  const [alturaFormulario, setAlturaFormulario] = useState(0);
  const alturaFaixa = alturaVideoLogin(alturaDisponivel, alturaFormulario, insets.top);
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
      setError(t("Preencha e-mail e senha."));
      return;
    }
    setLoading("email");
    try {
      await signIn(email, password, remember);
    } catch (e) {
      setError(e instanceof Error ? t(traduzErro(e.message)) : t("Não foi possível entrar."));
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
      setError(e instanceof Error ? e.message : t("Não foi possível entrar."));
    } finally {
      setLoading(null);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={["bottom", "left", "right"]}>
      <StatusBar style="light" />
      <TecladoSeguro style={styles.flex}>
        {/* FormularioRolavel (23/09): o foco rola até o campo — ver o componente. */}
        <FormularioRolavel
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets={false}
          contentInsetAdjustmentBehavior="never"
          bounces={false}
          alwaysBounceVertical={false}
          showsVerticalScrollIndicator={false}
          onLayout={(event) => setAlturaDisponivel(event.nativeEvent.layout.height)}
          contentContainerStyle={styles.scroll}>
          {/* Faixa de topo com o vídeo (Hub): só visual, a lógica de login não muda. */}
          <LoginHeroVideo height={alturaFaixa} paddingTop={insets.top}>
            <Image
              source={require("@/assets/images/cbrio-wordmark.png")}
              style={styles.logo}
              resizeMode="contain"
              tintColor="#fff"
              accessible
              accessibilityLabel="CBRio"
            />
          </LoginHeroVideo>

          <View style={styles.body} onLayout={(event) => setAlturaFormulario(event.nativeEvent.layout.height)}>
          <View style={styles.card}>
            <View style={styles.form}>
              <Input
                label={t("E-mail")}
                value={email}
                onChangeText={setEmail}
                placeholder="voce@exemplo.com"
                keyboardType="email-address"
                autoComplete="email"
              />
              <Input
                label={t("Senha")}
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
                  label={t("Lembrar de mim")}
                />
                <Link href="/(auth)/recuperar-senha" style={styles.forgot}>
                  {t("Esqueci a senha")}
                </Link>
              </View>

              {error && <Text style={styles.error}>{error}</Text>}

              <Button
                title={t("Entrar")}
                onPress={handleLogin}
                loading={loading === "email"}
              />

              {/* Primeiro acesso (01/11): quem baixou o app e nunca entrou não tem
                  senha — o "Criar conta" do rodapé ficava fora da vista. */}
              <Button
                title={t("Primeiro acesso")}
                variant="ghost"
                onPress={() => router.push("/(auth)/cadastro")}
              />
              <View style={styles.dividerRow}>
                <View style={styles.divider} />
                <Text style={styles.dividerText}>{t("ou continue com")}</Text>
                <View style={styles.divider} />
              </View>

              <SocialButton
                provider="google"
                onPress={() => handleProvider("google")}
                loading={loading === "google"}
              />
              {/* Login Apple disponível no iPhone. */}
              {APPLE_SIGNIN_ENABLED && Platform.OS === "ios" && (
                <SocialButton
                  provider="apple"
                  onPress={() => handleProvider("apple")}
                  loading={loading === "apple"}
                />
              )}
            </View>
          </View>

          {__DEV__ && (
            <Button
              title={t("Entrar como visitante (preview)")}
              variant="ghost"
              onPress={enterPreview}
            />
          )}
          </View>
        </FormularioRolavel>
      </TecladoSeguro>
    </SafeAreaView>
  );
}

function traduzErro(msg: string) {
  if (msg.includes("Invalid login credentials"))
    return "E-mail ou senha incorretos.";
  if (msg.includes("Email not confirmed"))
    return "Confirme sua conta antes de entrar.";
  if (/rate limit|too many requests/i.test(msg))
    return "Muitos acessos agora. Tente de novo em instantes.";
  return msg;
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  scroll: {
    flexGrow: 1,
  },
  body: { width: "100%", maxWidth: 520, alignSelf: "center", paddingHorizontal: spacing.md, paddingVertical: 12, gap: spacing.sm },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    padding: spacing.md,
    alignItems: "center",
  },
  logo: { width: 154, height: 58 },
  form: { width: "100%", gap: spacing.sm },
  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    columnGap: spacing.sm,
    minHeight: 44,
  },
  forgot: { color: colors.brandMid, fontSize: font.size.sm, fontWeight: "600", paddingVertical: 12 },
  error: { color: colors.danger, fontSize: font.size.sm },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginVertical: spacing.xs,
  },
  divider: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerText: { color: colors.textMuted, fontSize: font.size.sm },
});
