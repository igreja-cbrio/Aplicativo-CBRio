// ============================================================================
// COMPLETAR CADASTRO · a porta de entrada de PESSOA no app (Marcos · 04/08/2026)
//
// Por que existe: entrar só com e-mail deixava a conta pendurada num cadastro
// fantasma criado pelo gatilho de auth.users — sem passar pelo matcher, sem
// exigir campo nenhum (13 dos 21 tinham nome = prefixo do e-mail, e já houve 1
// duplicata de pessoa real). Os líderes de grupo são os primeiros a usar o app,
// e o Marcos quer aproveitar pra fechar o cadastro de quem falta.
//
// Dois caminhos, o MESMO destino (um cadastro real, pelo matcher do sistema):
//   RÁPIDO  · digita o CPF → o servidor acha a pessoa → manda código pro
//             E-MAIL QUE JÁ ESTÁ NO CADASTRO → confirma. ⚠️ CPF não é senha:
//             quem prova posse daquela caixa é que é vinculado. (Canal é
//             e-mail porque a Meta recusou template de autenticação pra nossa
//             conta do WhatsApp Business — 04/08.)
//   COMPLETO · nome, telefone, nascimento (+CPF opcional) → matcher canônico.
// ============================================================================

import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useMembro } from "@/lib/useMembro";
import { useT } from "@/lib/i18n";
import { font, radius, spacing, type Palette } from "@/constants/theme";
import {
  identidadePorCpf, confirmarCodigoIdentidade, completarCadastroApp,
  type IdentidadePorCpf,
} from "@/lib/api";
import { trackEvento } from "@/lib/telemetria";

const soDigitos = (s: string) => s.replace(/\D/g, "");

const mascaraCpf = (v: string) => {
  const d = soDigitos(v).slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
};

const mascaraTelefone = (v: string) => {
  const d = soDigitos(v).slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
};

const mascaraData = (v: string) => {
  const d = soDigitos(v).slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
};

// dd/mm/aaaa → ISO. Sem Date() no meio: `new Date("2026-08-04")` é UTC e
// em fuso negativo volta um dia (a mesma armadilha da faixa etária).
function dataParaIso(br: string): string | null {
  const d = soDigitos(br);
  if (d.length !== 8) return null;
  const dia = Number(d.slice(0, 2));
  const mes = Number(d.slice(2, 4));
  const ano = Number(d.slice(4));
  if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return null;
  const anoAtual = new Date().getFullYear();
  if (ano < 1900 || ano > anoAtual) return null;
  return `${String(ano)}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

type Passo = "escolha" | "cpf" | "codigo" | "form";

export default function CompletarCadastroScreen() {
  const { user, signOut } = useAuth();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const router = useRouter();
  const t = useT();
  const { reload } = useMembro();

  const [passo, setPasso] = useState<Passo>("escolha");
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  // caminho rápido
  const [cpf, setCpf] = useState("");
  const [achado, setAchado] = useState<IdentidadePorCpf | null>(null);
  const [codigo, setCodigo] = useState("");

  // formulário completo
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [nascimento, setNascimento] = useState("");
  const [cpfOpcional, setCpfOpcional] = useState("");
  // ⚠️ Sexo OBRIGATÓRIO (Matheus · 05/08: "em todos os formulários"). Canônico
  // `masculino|feminino`, NUNCA "outro" — a coluna e os KPIs por sexo do sistema
  // não aceitam outro valor. O backend passou a exigir no /identidade/completar,
  // então sem este campo a tela não conseguiria mais salvar.
  const [sexo, setSexo] = useState<"masculino" | "feminino" | null>(null);

  const concluir = useCallback(async () => {
    await reload();
    router.replace("/");
  }, [reload, router]);

  async function buscarPorCpf() {
    setErro(null); setAviso(null);
    if (soDigitos(cpf).length !== 11) { setErro(t("Digite os 11 números do CPF.")); return; }
    setEnviando(true);
    try {
      const r = await identidadePorCpf(soDigitos(cpf));
      trackEvento("identidade_cpf", {
        // `reason` está na whitelist do backend; `encontrado`/`pode` não estavam
        // e iam pro lixo em silêncio.
        reason: r.encontrado ? (r.pode_confirmar ? "encontrado" : `encontrado_${r.motivo || "sem_canal"}`) : "nao_encontrado",
      });
      if (r.encontrado && r.pode_confirmar) {
        setAchado(r); setPasso("codigo");
      } else if (r.encontrado && (r.motivo === "sem_email" || r.motivo === "sem_telefone")) {
        // Achamos a pessoa, mas o cadastro não tem contato pra provar posse.
        setAviso(t("Achamos seu cadastro, mas ele está sem e-mail. Preencha seus dados que a gente completa."));
        setPasso("form");
      } else if (r.encontrado && r.motivo === "email_compartilhado") {
        // E-mail em 2+ cadastros (família) não prova que é você — o formulário
        // resolve pelo matcher e cai no SEU cadastro.
        setAviso(t("Esse e-mail é usado por mais de uma pessoa da família, então não dá pra confirmar por ele. Preencha seus dados — leva um minuto."));
        setPasso("form");
      } else if (r.encontrado && r.motivo === "sem_canal") {
        setAviso(t("Não conseguimos enviar o código agora. Preencha seus dados que a equipe confere."));
        setPasso("form");
      } else {
        setAviso(t("Não encontramos esse CPF. Preencha seus dados — é rápido."));
        setCpfOpcional(mascaraCpf(cpf));
        setPasso("form");
      }
    } catch (e) {
      setErro(e instanceof Error ? e.message : t("Não foi possível verificar agora."));
    } finally {
      setEnviando(false);
    }
  }

  async function confirmar() {
    setErro(null);
    if (soDigitos(codigo).length !== 6) { setErro(t("O código tem 6 números.")); return; }
    setEnviando(true);
    try {
      await confirmarCodigoIdentidade(achado?.verificacao_id || "", soDigitos(codigo));
      trackEvento("identidade_confirmada", {});
      await concluir();
    } catch (e) {
      setErro(e instanceof Error ? e.message : t("Não foi possível confirmar agora."));
    } finally {
      setEnviando(false);
    }
  }

  async function salvarForm() {
    setErro(null);
    const iso = dataParaIso(nascimento);
    if (nome.trim().split(/\s+/).length < 2) { setErro(t("Escreva seu nome completo.")); return; }
    if (soDigitos(telefone).length < 10) { setErro(t("Informe seu telefone com DDD.")); return; }
    if (!iso) { setErro(t("Informe sua data de nascimento (dd/mm/aaaa).")); return; }
    if (!sexo) { setErro(t("Selecione o sexo.")); return; }
    const cpfDig = soDigitos(cpfOpcional);
    if (cpfDig && cpfDig.length !== 11) { setErro(t("O CPF precisa ter 11 números (ou deixe em branco).")); return; }
    setEnviando(true);
    try {
      const r = await completarCadastroApp({
        nome_completo: nome.trim(),
        telefone: soDigitos(telefone),
        data_nascimento: iso,
        sexo,
        email: user?.email || undefined,
        cpf: cpfDig || undefined,
      });
      trackEvento("identidade_completada", { reason: r.criado ? "criado" : "vinculado" });
      await concluir();
    } catch (e) {
      setErro(e instanceof Error ? e.message : t("Não foi possível salvar agora."));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <Stack.Screen options={{ headerShown: false, gestureEnabled: false }} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.hero}>
          <Ionicons name="person-circle-outline" size={44} color={colors.brandMid} />
          <Text style={styles.titulo}>{t("Vamos confirmar quem você é")}</Text>
          <Text style={styles.sub}>
            {t("É uma vez só. Assim seu grupo, suas inscrições e seus dados aparecem certos aqui — e a igreja não fica com dois cadastros seus.")}
          </Text>
        </View>

        {!!aviso && (
          <View style={styles.avisoBox}>
            <Ionicons name="information-circle-outline" size={16} color={colors.brandMid} />
            <Text style={styles.avisoTxt}>{aviso}</Text>
          </View>
        )}

        {passo === "escolha" && (
          <View style={styles.bloco}>
            <Pressable style={styles.opcao} onPress={() => { setPasso("cpf"); setAviso(null); }} accessibilityRole="button">
              <Ionicons name="flash-outline" size={22} color={colors.brandMid} />
              <View style={{ flex: 1 }}>
                <Text style={styles.opcaoTitulo}>{t("Já sou cadastrado")}</Text>
                <Text style={styles.opcaoSub}>{t("Digite seu CPF — a gente acha seus dados e confirma pelo seu e-mail.")}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </Pressable>

            <Pressable style={styles.opcao} onPress={() => { setPasso("form"); setAviso(null); }} accessibilityRole="button">
              <Ionicons name="create-outline" size={22} color={colors.brandMid} />
              <View style={{ flex: 1 }}>
                <Text style={styles.opcaoTitulo}>{t("É meu primeiro cadastro")}</Text>
                <Text style={styles.opcaoSub}>{t("Preencher nome, telefone e nascimento.")}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </Pressable>
          </View>
        )}

        {passo === "cpf" && (
          <View style={styles.bloco}>
            <Input
              label={t("Seu CPF")}
              value={cpf}
              onChangeText={(v: string) => setCpf(mascaraCpf(v))}
              keyboardType="number-pad"
              placeholder="000.000.000-00"
            />
            <Text style={styles.nota}>
              {t("Vamos enviar um código pro e-mail que já está no seu cadastro — é assim que confirmamos que é você.")}
            </Text>
            {!!erro && <Text style={styles.erro}>{erro}</Text>}
            <Button title={t("Continuar")} onPress={buscarPorCpf} disabled={enviando} />
            <Pressable onPress={() => { setPasso("form"); setErro(null); }}>
              <Text style={styles.link}>{t("Prefiro preencher meus dados")}</Text>
            </Pressable>
          </View>
        )}

        {passo === "codigo" && (
          <View style={styles.bloco}>
            <Text style={styles.confereTxt}>
              {t("Achamos o cadastro de")} <Text style={styles.forte}>{achado?.nome_mascarado}</Text>.{"\n"}
              {t("Enviamos um código pro e-mail")}{" "}
              <Text style={styles.forte}>{achado?.email_mascarado || achado?.telefone_mascarado}</Text>.
            </Text>
            <Input
              label={t("Código de 6 números")}
              value={codigo}
              onChangeText={(v: string) => setCodigo(soDigitos(v).slice(0, 6))}
              keyboardType="number-pad"
              placeholder="000000"
            />
            {!!erro && <Text style={styles.erro}>{erro}</Text>}
            <Button title={t("Confirmar")} onPress={confirmar} disabled={enviando} />
            <Pressable onPress={() => { setPasso("cpf"); setCodigo(""); setErro(null); }}>
              <Text style={styles.link}>{t("Não recebi o código")}</Text>
            </Pressable>
            <Text style={styles.nota}>
              {t("Esse e-mail não é seu? Fale com a coordenação — a gente atualiza seu cadastro.")}
            </Text>
          </View>
        )}

        {passo === "form" && (
          <View style={styles.bloco}>
            <Input
              label={t("Nome completo")}
              value={nome}
              onChangeText={setNome}
              autoCapitalize="words"
              placeholder={t("Como está no seu documento")}
            />
            <Input
              label={t("Celular com DDD")}
              value={telefone}
              onChangeText={(v: string) => setTelefone(mascaraTelefone(v))}
              keyboardType="phone-pad"
              placeholder="(21) 99999-9999"
            />
            <Input
              label={t("Data de nascimento")}
              value={nascimento}
              onChangeText={(v: string) => setNascimento(mascaraData(v))}
              keyboardType="number-pad"
              placeholder="dd/mm/aaaa"
            />
            <View style={styles.sexoBloco}>
              <Text style={styles.sexoLabel}>{t("Sexo")}</Text>
              <View style={styles.sexoRow}>
                {([
                  { v: "masculino", label: t("Masculino") },
                  { v: "feminino", label: t("Feminino") },
                ] as const).map((opt) => {
                  const ativo = sexo === opt.v;
                  return (
                    <Pressable
                      key={opt.v}
                      onPress={() => setSexo(opt.v)}
                      style={[styles.sexoPill, ativo && styles.sexoPillOn]}
                      accessibilityRole="button"
                      accessibilityState={{ selected: ativo }}
                    >
                      <Text style={[styles.sexoTxt, ativo && styles.sexoTxtOn]}>{opt.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
            <Input
              label={t("CPF (opcional, ajuda a achar seu cadastro)")}
              value={cpfOpcional}
              onChangeText={(v: string) => setCpfOpcional(mascaraCpf(v))}
              keyboardType="number-pad"
              placeholder="000.000.000-00"
            />
            {!!erro && <Text style={styles.erro}>{erro}</Text>}
            <Button title={t("Salvar e entrar")} onPress={salvarForm} disabled={enviando} />
            <Pressable onPress={() => { setPasso("escolha"); setErro(null); }}>
              <Text style={styles.link}>{t("Voltar")}</Text>
            </Pressable>
          </View>
        )}

        {enviando && <ActivityIndicator color={colors.brandMid} style={{ marginTop: spacing.md }} />}

        <Pressable onPress={() => signOut()} style={styles.sair}>
          <Text style={styles.sairTxt}>{t("Sair da conta")}</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    sexoBloco: { gap: spacing.xs },
    sexoLabel: { color: colors.text, fontSize: font.size.sm, fontWeight: "600" },
    sexoRow: { flexDirection: "row", gap: spacing.sm },
    sexoPill: {
      flex: 1, paddingVertical: 10, borderRadius: radius.md, borderWidth: 1,
      borderColor: colors.glassBorder, backgroundColor: colors.glass,
      alignItems: "center", justifyContent: "center",
    },
    sexoPillOn: { backgroundColor: colors.brandMid, borderColor: colors.brandMid },
    sexoTxt: { color: colors.text, fontSize: font.size.sm, fontWeight: "600" },
    sexoTxtOn: { color: "#ffffff" },
    safe: { flex: 1, backgroundColor: colors.background },
    content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: 60 },
    hero: { alignItems: "center", gap: spacing.sm, marginTop: spacing.xl },
    titulo: { color: colors.text, fontSize: font.size.xl, fontWeight: "800", textAlign: "center" },
    sub: { color: colors.textMuted, fontSize: font.size.sm, textAlign: "center", lineHeight: 20 },
    bloco: { gap: spacing.md },
    opcao: {
      flexDirection: "row", alignItems: "center", gap: spacing.md,
      padding: spacing.lg, borderRadius: radius.lg,
      backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    },
    opcaoTitulo: { color: colors.text, fontSize: font.size.md, fontWeight: "700" },
    opcaoSub: { color: colors.textMuted, fontSize: font.size.sm, marginTop: 2 },
    nota: { color: colors.textMuted, fontSize: font.size.sm, lineHeight: 19 },
    confereTxt: { color: colors.text, fontSize: font.size.md, lineHeight: 22 },
    forte: { fontWeight: "800" },
    erro: { color: colors.danger, fontSize: font.size.sm },
    link: { color: colors.brandMid, fontSize: font.size.sm, textAlign: "center", fontWeight: "600" },
    avisoBox: {
      flexDirection: "row", gap: spacing.sm, alignItems: "flex-start",
      padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surfaceAlt,
    },
    avisoTxt: { flex: 1, color: colors.text, fontSize: font.size.sm, lineHeight: 19 },
    sair: { alignItems: "center", paddingTop: spacing.lg },
    sairTxt: { color: colors.textMuted, fontSize: font.size.sm },
  });
