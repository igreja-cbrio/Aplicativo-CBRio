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
import { completarCadastroApp } from "@/lib/api";
import { iniciarCadastroNativo, terminarCadastroNativo } from "@/lib/cadastroEmAndamento";
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
  // ⚠️ Sexo OBRIGATÓRIO (Matheus · 05/08: "em todos os formulários"). Canônico
  // `masculino|feminino`, NUNCA "outro" — lei do Contrato de Inscrição.
  const [sexo, setSexo] = useState<"masculino" | "feminino" | null>(null);
  const [frequentaArea, setFrequentaArea] = useState<"ami" | "bridge" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSignUp() {
    setError(null);
    if (!nome || !cpf || !nascimento || !phone || !email || !password) {
      setError(t("Preencha todos os campos."));
      return;
    }
    if (!sexo) {
      setError(t("Selecione o sexo."));
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
    // ⚠️ Levanta a bandeira ANTES do signUp: a sessão nasce lá dentro e o
    // `CadastroGate` monta na mesma hora. Sem isto ele pergunta o status
    // enquanto o carimbo ainda está sendo gravado e rebate a pessoa pra tela de
    // cadastro — foi o que aconteceu no 2º teste (ver lib/cadastroEmAndamento).
    iniciarCadastroNativo();
    try {
      const { needsEmailConfirmation } = await signUp(email, password, {
        nome,
        cpf: onlyDigits(cpf),
        dataNascimento: dateBRToISO(nascimento)!,
        telefone: `+${country.dial}${onlyDigits(phone)}`,
        sexo,
        frequentaArea,
      });
      if (needsEmailConfirmation) {
        Alert.alert(
          t("Confirme seu e-mail"),
          t("Enviamos um link de confirmação para o seu e-mail. Confirme para entrar."),
          [{ text: "OK", onPress: () => router.replace("/(auth)/login") }]
        );
      } else {
        // ⚠️⚠️ SEM ISTO, QUEM ACABOU DE SE CADASTRAR ERA MANDADO PRA TELA DE
        // CADASTRO DE NOVO (07/08 · relato do Marcos: "preenchi todos os dados,
        // mas quando entrei ele pediu novamente pra eu confirmar quem eu era").
        //
        // Desde 05/08 o portão exige `profiles.app_ficha_confirmada_em` — a
        // marca de que ESTA CONTA provou a ficha (dado herdado de vínculo não
        // libera acesso). Só que o carimbo é escrito em DOIS lugares, os dois
        // do fluxo de quem entra por login: `/identidade/completar` e
        // `/identidade/confirmar`. O cadastro nativo, que é justamente onde a
        // pessoa DIGITOU tudo, não passava por nenhum deles: nascia com a ficha
        // completa em `mem_membros` (o gatilho grava) e `confirmouFicha` false
        // ⇒ `completo: false` ⇒ o `CadastroGate` rebatia. Medido na conta de
        // teste: 3min19s preso na porta, e ele ainda recebeu um código por
        // e-mail pra provar que era quem tinha acabado de dizer que era.
        //
        // Aqui a pessoa já tem sessão (logo, JWT) e os dados na mão: mandamos
        // pela porta canônica, que faz o matcher, vincula o profile, manda par
        // duvidoso pra fila de /entradas em vez de fundir, e CARIMBA.
        //
        // ⚠️ Best-effort de propósito: falha de rede aqui NÃO derruba o cadastro
        // (a conta já existe) — cai no comportamento de hoje, com o gate
        // pedindo a ficha. Zero regressão no pior caso.
        // ⚠️ E NÃO relaxa nada no servidor: `completo` continua exigindo
        // `falta: []`, então o carimbo nunca vira atalho de acesso.
        try {
          await completarCadastroApp({
            nome_completo: nome,
            telefone: `+${country.dial}${onlyDigits(phone)}`,
            data_nascimento: dateBRToISO(nascimento)!,
            email,
            cpf: onlyDigits(cpf),
            sexo,
          });
        } catch (err) {
          console.warn("[cadastro] não foi possível confirmar a ficha agora:", err);
        }
      }
      // Com a sessão criada, o guard de rotas leva direto para a área logada.
    } catch (e) {
      setError(e instanceof Error ? e.message : t("Não foi possível criar a conta."));
    } finally {
      // Baixa a bandeira SEMPRE — inclusive quando deu erro. Aí o portão volta
      // a decidir normalmente (e é ele quem manda pra tela de cadastro, com
      // razão, se a ficha não fechou).
      terminarCadastroNativo();
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
                <Text style={styles.areaLabel}>{t("Sexo")}</Text>
                <View style={styles.areaRow}>
                  {([
                    { v: "masculino", label: t("Masculino") },
                    { v: "feminino", label: t("Feminino") },
                  ] as const).map((opt) => {
                    const ativo = sexo === opt.v;
                    return (
                      <Pressable
                        key={opt.v}
                        onPress={() => setSexo(opt.v)}
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
