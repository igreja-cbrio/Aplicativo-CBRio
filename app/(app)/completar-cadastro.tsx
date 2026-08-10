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
//   COMPLETO · nome, telefone, nascimento, CPF e sexo → matcher canônico.
//
// ⚠️ FICHA FECHADA NA ENTRADA (Marcos · 05/08/2026) — com UMA exceção medida no
// mesmo dia: **SEXO é obrigatório; CPF é pedido com destaque mas NÃO bloqueia**.
// Sem CPF o `POST /app/inscricoes` recusa qualquer inscrição (50 das 75 contas
// entravam "completas" pra serem barradas depois), então o certo seria exigir —
// mas as contas de revisão da Apple travariam nesta tela e o revisor não tem CPF
// brasileiro pra digitar, que é a rejeição clássica de "não passamos do
// registro". Quem não põe CPF aqui é levado a completar quando tenta se
// inscrever (`grupo-detalhe` já faz isso). Ligar o gate junto do `exigirCpf` do
// backend, depois da aprovação do build iOS. A validação real está no submit —
// se este comentário divergir dela, a validação é que manda.
// Os campos que o cadastro JÁ TEM vêm preenchidos — ninguém digita duas vezes.
// ============================================================================

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useMembro } from "@/lib/useMembro";
import { useT } from "@/lib/i18n";
import { font, radius, spacing, type Palette } from "@/constants/theme";
import { completarCadastroApp, confirmarCodigoIdentidade, identidadePorCpf, statusIdentidade, type IdentidadePorCpf } from "@/lib/api";
import { trackEvento } from "@/lib/telemetria";
// Réguas de campo do app (as MESMAS das outras telas) — esta tela
// reimplementava versões mais fracas, que só o servidor recusava.
import { isValidCPF, nascimentoBRParaISO } from "@/lib/validators";
import { TecladoSeguro } from "@/components/ui/TecladoSeguro";

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

// dd/mm/aaaa → ISO válido, ou null. A régua vive em `lib/validators.ts`
// (`nascimentoBRParaISO`), no PORTÃO: aqui dentro do .tsx ela não seria testada,
// e a versão que morava aqui aceitava 31/02 — a pessoa só descobria no 400 do
// servidor, na porta que todo mundo atravessa pra entrar no app.
const dataParaIso = (br: string) => nascimentoBRParaISO(br);

type Passo = "escolha" | "cpf" | "codigo" | "form";

/** O servidor manda CHAVES em `falta` ('nascimento', 'sexo'…). Mostrar a chave
 *  crua faria a tela dizer "falta sexo" com cara de erro de sistema. */
const ROTULO_FALTA: Record<string, string> = {
  nome: "seu nome completo",
  telefone: "seu telefone",
  nascimento: "sua data de nascimento",
  cpf: "seu CPF",
  sexo: "seu sexo",
};

export default function CompletarCadastroScreen() {
  const { user, signOut } = useAuth();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const router = useRouter();
  // Pra onde volto ao concluir (a tela que me mandou pra cá). Sem isso o
  // cadastro sempre despejava na Home.
  const { retorno } = useLocalSearchParams<{ retorno?: string }>();
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
  const { membro } = useMembro();
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [nascimento, setNascimento] = useState("");
  const [cpfForm, setCpfForm] = useState("");
  const [sexo, setSexo] = useState<"masculino" | "feminino" | "">("");
  // O servidor diz se o CPF é obrigatório (default: SIM — fail-closed, senão uma
  // falha de rede viraria porta aberta pra entrar sem cadastro).
  const [exigeCpf, setExigeCpf] = useState(true);

  // ⚠️⚠️ PRÉ-PREENCHER DADO HERDADO É "CONFIRMAR" O QUE A PESSOA NÃO FORNECEU
  // (Marcos · 05/08): "qual CPF de Pedro Paiva que cadastrou no app? Data de
  // nascimento, Sexo? Só tem email e nome". O gatilho de auth liga por e-mail +
  // nome, então o cadastro encontrado pode ter CPF/nascimento de um import — ou
  // de outra pessoa. Enquanto o servidor não disser que ESTA conta já confirmou
  // (`pode_preencher_com_vinculo`), o formulário traz **só o nome** (que veio do
  // provedor do login) e a pessoa digita o resto. Depois de confirmar, o prefill
  // volta a valer: aí é ela editando a própria ficha.
  const [podeUsarVinculo, setPodeUsarVinculo] = useState<boolean | null>(null);
  const prefilled = useRef(false);
  useEffect(() => {
    if (prefilled.current || !membro || podeUsarVinculo === null) return;
    prefilled.current = true;
    if (membro.nome && !membro.nome.includes("@")) setNome(membro.nome);
    if (!podeUsarVinculo) return; // 1ª confirmação: só o nome
    if (membro.telefone) setTelefone(mascaraTelefone(membro.telefone));
    if (membro.cpf) setCpfForm(mascaraCpf(membro.cpf));
    if (membro.dataNascimento) {
      const [a, m, d] = String(membro.dataNascimento).slice(0, 10).split("-");
      if (a && m && d) setNascimento(`${d}/${m}/${a}`);
    }
  }, [membro, podeUsarVinculo]);

  // ⚠️ Quem decide se o CPF é obrigatório é o SERVIDOR (`exige_cpf`). Falha de
  // rede mantém o default TRUE (fail-closed): sem isso, ficar offline viraria
  // porta pra entrar sem cadastro — o oposto do que o gate existe pra fazer.
  useEffect(() => {
    let vivo = true;
    statusIdentidade()
      .then((s) => {
        if (!vivo) return;
        if (s.exige_cpf === false) setExigeCpf(false);
        // ⚠️ Default FALSE (não pré-preenche) quando o servidor não responde: na
        // dúvida, a pessoa digita. O contrário faria uma falha de rede virar
        // caminho pra confirmar dado herdado — o oposto do que o gate quer.
        setPodeUsarVinculo(s.pode_preencher_com_vinculo === true);
      })
      .catch(() => { if (vivo) setPodeUsarVinculo(false); });
    return () => {
      vivo = false;
    };
  }, []);

  // ⚠️⚠️ NÃO SAIR DAQUI PARA SER REBATIDO (conserto do LOOP · 10/08/2026).
  //
  // O relato: "preencho e volta pra mesma tela; não consigo entrar no app".
  // Medido em produção: uma pessoa viu esta tela 9 VEZES e confirmou 3.
  //
  // Eram duas causas somadas. No servidor, o que a pessoa digitava era validado
  // e DESCARTADO quando o matcher achava o cadastro dela (corrigido em
  // appIdentidade.js). E aqui: `concluir()` navegava embora sem conferir nada —
  // o portão então recalculava, achava campo faltando e devolvia a pessoa pra
  // esta tela, que recomeça no passo do CPF. Ela tentava o caminho rápido de
  // novo, confirmava de novo, e voltava de novo.
  //
  // Agora a tela PERGUNTA antes de sair. Se ainda falta algo, ela não entrega a
  // pessoa a um portão que vai recusá-la: fica aqui, abre o formulário e DIZ o
  // que falta. Sair para ser rebatido é o loop; ficar e pedir o campo é a saída.
  const concluir = useCallback(async () => {
    await reload();

    try {
      const s = await statusIdentidade();
      if (s.completo === false) {
        const faltando = (s.falta || []).map((f) => ROTULO_FALTA[f] || f);
        setPasso("form");
        setAviso(
          faltando.length
            ? `${t("Falta só")} ${faltando.join(", ")}.`
            : t("Ainda falta completar seu cadastro."),
        );
        return;
      }
    } catch {
      // Erro de rede aqui NÃO prende a pessoa: o portão faz a própria conferência
      // e, se de fato faltar algo, ela volta pra cá com o aviso. Travar numa tela
      // por falha de conexão é o defeito que este conserto existe para tirar.
    }

    // ⚠️ `retorno` traz a pessoa de volta pra onde ela ESTAVA (ex.: o evento em
    // que ela ia se inscrever) em vez de despejá-la na Home — completar o
    // cadastro é um desvio no meio de uma tarefa, não a tarefa.
    // Só aceitamos caminho interno começando por "/": `retorno` vem da URL e
    // um `http://` ali viraria porta de navegação pra fora do app.
    if (typeof retorno === "string" && retorno.startsWith("/") && !retorno.startsWith("//")) {
      router.replace(retorno as never);
      return;
    }
    router.replace("/");
  }, [reload, router, retorno, t]);

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
        setCpfForm(mascaraCpf(cpf));
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
    const cpfDig = soDigitos(cpfForm);
    // ⚠️⚠️ CPF OBRIGATÓRIO (decisão do Marcos · 05/08/2026): "todas as pessoas
    // que entrarem no sistema devem completar o cadastro antes; após completar
    // elas acessam normalmente". Sem CPF a pessoa entrava e era barrada na
    // primeira inscrição (o `POST /app/inscricoes` recusa) — 50 das 75 contas.
    // ⚠️ Quem manda é o SERVIDOR: `exige_cpf` vem do `/identidade/status` e é
    // false SÓ pra conta de revisão de loja (o revisor não tem CPF brasileiro e
    // travaria aqui → build recusado). O app não decide isso sozinho.
    // ⚠️ DV do CPF conferido AQUI (06/08/2026): o servidor exige CPF válido
    // (`validarCamposPadrao` → `normalizarCpf`), então sem esta checagem a
    // pessoa só descobria o dígito errado depois de enviar, num 400 seco. É a
    // MESMA régua do resto do app (`lib/validators.ts`).
    if (exigeCpf && !isValidCPF(cpfDig)) {
      setErro(
        cpfDig.length !== 11
          ? t("Informe seu CPF (11 números) para continuar.")
          : t("Esse CPF não é válido. Confira os números."),
      );
      return;
    }
    if (!exigeCpf && cpfDig && !isValidCPF(cpfDig)) {
      setErro(t("Esse CPF não é válido (ou deixe em branco)."));
      return;
    }
    if (!sexo) { setErro(t("Selecione masculino ou feminino.")); return; }
    setEnviando(true);
    try {
      const r = await completarCadastroApp({
        nome_completo: nome.trim(),
        telefone: soDigitos(telefone),
        data_nascimento: iso,
        email: user?.email || undefined,
        cpf: cpfDig || undefined,
        sexo,
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
      {/* ⚠️ Esta é a porta OBRIGATÓRIA do app e estava sem KeyboardAvoidingView
          nenhum — nem no iPhone (varredura de 07/08). `padding` nas duas
          plataformas: o cálculo do RN é auto-corretivo. */}
      <TecladoSeguro style={{ flex: 1 }}>
      <ScrollView
        automaticallyAdjustKeyboardInsets
        contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
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
                <Text style={styles.opcaoSub}>{t("Preencher nome, telefone, nascimento e sexo.")}</Text>
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
            <Input
              label={exigeCpf ? t("CPF *") : t("CPF (recomendado)")}
              value={cpfForm}
              onChangeText={(v: string) => setCpfForm(mascaraCpf(v))}
              keyboardType="number-pad"
              placeholder="000.000.000-00"
            />
            <Text style={styles.nota}>
              {t("O CPF é o que liga você ao seu cadastro na igreja e o que permite se inscrever em grupos, batismo e NEXT.")}
            </Text>

            {/* ⚠️ Sexo: só masculino/feminino — é o que o Contrato de Inscrição
                do sistema aceita (`masculino|feminino`, NUNCA "outro"), e é o
                que a inscrição de batismo/apresentação precisa ter na ficha
                pra não perguntar de novo. */}
            <View style={{ gap: spacing.xs }}>
              <Text style={styles.campoLabel}>{t("Sexo")}</Text>
              <View style={styles.sexoRow}>
                {(["masculino", "feminino"] as const).map((v) => {
                  const sel = sexo === v;
                  return (
                    <Pressable
                      key={v}
                      onPress={() => setSexo(v)}
                      style={[styles.sexoPill, sel && styles.sexoPillSel]}
                      accessibilityRole="button"
                      accessibilityState={{ selected: sel }}
                    >
                      <Text style={[styles.sexoTxt, sel && styles.sexoTxtSel]}>
                        {v === "masculino" ? t("Masculino") : t("Feminino")}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

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
      </TecladoSeguro>
    </SafeAreaView>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
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
    campoLabel: { color: colors.textMuted, fontSize: font.size.sm, fontWeight: "700" },
    sexoRow: { flexDirection: "row", gap: spacing.sm },
    sexoPill: { flex: 1, alignItems: "center", paddingVertical: 12, borderRadius: radius.full, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
    sexoPillSel: { backgroundColor: colors.primary, borderColor: colors.primary },
    sexoTxt: { color: colors.text, fontSize: font.size.md, fontWeight: "600" },
    sexoTxtSel: { color: "#fff" },
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
