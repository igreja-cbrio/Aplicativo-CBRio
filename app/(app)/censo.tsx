// ============================================================================
//  CENSO · disponível só para quem ainda não respondeu
//
//  Pedido do Matheus (08/08): o censo aparece no app para quem não fez; quem já
//  fez vê um aviso de que já preencheu.
//
//  ⚠️ QUEM DECIDE É O BACKEND, e isso é deliberado. A tela não calcula nada:
//  `GET /app/censo` devolve `ja_respondeu` E a `url`, e a url só é emitida para
//  quem pode responder. Se um dia esta tela tiver um bug e ignorar a flag, ela
//  não tem para onde abrir — a trava não depende de o app estar atualizado, e é
//  bom que não dependa: OTA chega em todo mundo, mas ninguém controla quando.
//
//  ⚠️ O FORMULÁRIO NÃO É REESCRITO AQUI. São 108 perguntas com condicionais,
//  rascunho, fila offline e um bloco sensível — tudo já testado e no ar. Abrimos
//  o mesmo formulário num WebView, com um token de identidade assinado que o
//  backend emitiu para esta sessão: a pessoa não digita CPF, porque o app já
//  sabe quem ela é. Uma segunda implementação em React Native seria uma segunda
//  fonte de verdade, e a que ficasse para trás mentiria em silêncio.
// ============================================================================
import { useCallback, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Stack, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Button } from "@/components/ui/Button";
import { GlassCard } from "@/components/ui/GlassCard";
import { TecladoSeguro } from "@/components/ui/TecladoSeguro";
import { useColors } from "@/contexts/ThemeContext";
import { useT } from "@/lib/i18n";
import { subirUmNivel } from "@/lib/hierarquia";
import { apiGet } from "@/lib/api";
import * as WebBrowser from "expo-web-browser";
import * as Crypto from "expo-crypto";
import FormCenso from "@/components/censo/FormCenso";
import {
  buscarPesquisa, prefill, enviarResposta, tiposNaoSuportados,
  type PesquisaPublica,
} from "@/lib/censoApi";
import type { Respostas } from "@/lib/censoForm";
import { font, radius, spacing, type Palette } from "@/constants/theme";

type CensoStatus = {
  pesquisa: { slug: string; titulo: string; subtitulo: string | null; fecha_em: string | null } | null;
  motivo?: "sem_cadastro" | "nenhuma_aberta";
  ja_respondeu?: boolean;
  respondida_em?: string | null;
  url?: string | null;
  /** Token cru — é com ele que o formulário NATIVO se identifica. */
  token?: string | null;
};

function dataCurta(iso: string | null | undefined) {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? null
    : d.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
}

export default function CensoScreen() {
  const colors = useColors();
  const t = useT();
  // ⚠️⚠️ Insets lidos AQUI, no corpo da tela — de propósito. Dentro de um `Modal`
  // do React Native o SafeAreaView do safe-area-context não recebe inset nenhum
  // (o modal é outra hierarquia nativa, e o provider vive na raiz do app), então
  // `edges={["top"]}` não aplicava NADA: o cabeçalho com o X ficava por trás da
  // Dynamic Island. O hook, chamado fora do modal, devolve o valor certo e a
  // gente aplica na mão.
  //
  // ⚠️⚠️ E VALE NAS DUAS PLATAFORMAS (17/08/2026). Antes era
  // `Platform.OS === "ios" ? insets.top : 0`, apostando que o Android desenharia
  // o modal ABAIXO da barra de status. Com **edge-to-edge ligado** (default do
  // SDK 54 · medido e registrado no CLAUDE.md) essa aposta é falsa: o modal
  // desenha de ponta a ponta e o cabeçalho com o X ficava por baixo do relógio
  // e da bateria — foi o "topo quase saindo da tela" que o Matheus reportou.
  // Com `statusBarTranslucent` o comportamento deixa de ser aposta: o modal
  // SEMPRE começa em y=0, e o inset é sempre a compensação correta.
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [status, setStatus] = useState<CensoStatus | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [abrindo, setAbrindo] = useState(false);

  const carregar = useCallback(async () => {
    setErro(null);
    try {
      setStatus(await apiGet<CensoStatus>("/app/censo"));
    } catch (e) {
      // Erro de rede não pode virar "você já respondeu" nem "não tem censo":
      // as duas seriam afirmações falsas com cara de informação.
      setErro(e instanceof Error ? e.message : t("Não consegui carregar agora."));
    }
  }, []);

  // Recarrega ao voltar para a tela — inclusive depois de fechar o WebView,
  // que é exatamente quando `ja_respondeu` costuma ter mudado.
  useFocusEffect(useCallback(() => { carregar(); }, [carregar]));

  const p = status?.pesquisa;

  // ── formulário nativo ─────────────────────────────────────────────────────
  const [form, setForm] = useState<PesquisaPublica | null>(null);
  const [valoresIniciais, setValoresIniciais] = useState<Respostas>({});
  const [carregandoForm, setCarregandoForm] = useState(false);
  const [erroForm, setErroForm] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [erroEnvio, setErroEnvio] = useState<string | null>(null);
  const [enviado, setEnviado] = useState(false);

  const naoSuportados = useMemo(
    () => (form ? tiposNaoSuportados(form.perguntas) : []),
    [form],
  );

  // ⚠️ `envio_id` nasce UMA vez por abertura do formulário e não muda em
  // re-tentativa: é ele que dá a idempotência no servidor (UNIQUE parcial por
  // pesquisa+envio). Gerar um novo a cada toque em "Enviar" transformaria
  // toque duplo em duas respostas.
  const envioId = useRef<string>("");

  async function abrirFormulario() {
    if (!p?.slug) return;
    setAbrindo(true);
    setEnviado(false);
    setErroEnvio(null);
    setErroForm(null);
    setCarregandoForm(true);
    envioId.current = Crypto.randomUUID();
    try {
      const pesquisa = await buscarPesquisa(p.slug);
      setForm(pesquisa);
      // Pré-preenchimento é conveniência: se falhar, a pessoa preenche à mão.
      if (status?.token) {
        try {
          const r = await prefill(p.slug, status.token);
          setValoresIniciais(r?.valores || {});
        } catch { setValoresIniciais({}); }
      }
    } catch (e) {
      setErroForm(e instanceof Error ? e.message : t("Tente de novo."));
    } finally {
      setCarregandoForm(false);
    }
  }

  async function abrirNaWeb() {
    if (!status?.url) return;
    setAbrindo(false);
    await WebBrowser.openBrowserAsync(status.url, { dismissButtonStyle: "close" });
    carregar();
  }

  async function enviarRespostas(respostas: Respostas, consentimento: boolean) {
    if (!p?.slug) return;
    setEnviando(true);
    setErroEnvio(null);
    try {
      await enviarResposta(p.slug, {
        respostas, consentimento,
        envio_id: envioId.current,
        identidade: status?.token || null,
      });
      setEnviado(true);
    } catch (e) {
      // ⚠️ Mensagem do servidor, não "algo deu errado": ele diz QUAL resposta
      // obrigatória falta, e é a única informação que resolve.
      setErroEnvio(e instanceof Error ? e.message : t("Não consegui enviar. Tente de novo."));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.header}>
        <Pressable
          onPress={() => subirUmNivel("/censo")}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={t("Voltar")}
        >
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>{t("Censo")}</Text>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {erro ? (
          <GlassCard style={styles.card}>
            <Text style={styles.titulo}>{t("Não consegui carregar")}</Text>
            <Text style={styles.texto}>{erro}</Text>
            <Button title={t("Tentar de novo")} onPress={carregar} />
          </GlassCard>
        ) : !status ? (
          <View style={styles.centro}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : !p ? (
          <GlassCard style={styles.card}>
            <Ionicons name="clipboard-outline" size={30} color={colors.textMuted} />
            <Text style={styles.titulo}>{t("Nenhum censo aberto")}</Text>
            <Text style={styles.texto}>
              {status.motivo === "sem_cadastro"
                ? t("Complete seu cadastro no app para participar dos próximos censos.")
                : t("Quando a igreja abrir um novo censo, ele aparece aqui.")}
            </Text>
          </GlassCard>
        ) : status.ja_respondeu ? (
          // O aviso que o Matheus pediu. Diz a data de propósito: "você já
          // respondeu" sem quando deixa a pessoa na dúvida se foi ela mesma.
          <GlassCard style={styles.card}>
            <Ionicons name="checkmark-circle" size={34} color={colors.success} />
            <Text style={styles.titulo}>{t("Você já respondeu")}</Text>
            <Text style={styles.texto}>
              {dataCurta(status.respondida_em)
                ? `${t("Recebemos sua resposta do")} ${p.titulo} ${t("em")} ${dataCurta(status.respondida_em)}.`
                : `${t("Recebemos sua resposta do")} ${p.titulo}.`}
            </Text>
            <Text style={styles.rodape}>
              {t("Cada pessoa responde uma vez só — é o que mantém os números certos. Obrigado por ter participado.")}
            </Text>
          </GlassCard>
        ) : (
          <GlassCard style={styles.card}>
            <Ionicons name="clipboard-outline" size={34} color={colors.primary} />
            <Text style={styles.titulo}>{p.titulo}</Text>
            {!!p.subtitulo && <Text style={styles.texto}>{p.subtitulo}</Text>}
            <Text style={styles.texto}>
              {t("Seus dados de cadastro já vêm preenchidos — você não precisa digitar CPF nem nome de novo.")}
            </Text>
            {!!dataCurta(p.fecha_em) && (
              <Text style={styles.rodape}>{t("Aberto até")} {dataCurta(p.fecha_em)}.</Text>
            )}
            <View style={styles.acaoLarga}>
              <Button
                title={t("Responder o censo")}
                onPress={abrirFormulario}
                disabled={!status.url}
              />
            </View>
          </GlassCard>
        )}
      </ScrollView>

      {/* ⚠️ FORMULÁRIO NATIVO (decisão do Matheus · 10/08/2026): quem preenche
          PELO APP responde aqui dentro; o QR do culto continua abrindo a web.
          O WebView saiu — ele custou dois bugs de chrome (cabeçalho atrás da
          Dynamic Island, X de fechar escondido) e nenhum deles era da página.

          ⚠️ MAS a web continua sendo a implementação COMPLETA. Se o
          questionário tiver um tipo de pergunta que este app não renderiza, o
          app NÃO tenta improvisar nem esconde a pergunta — manda para a web.
          Esconder faria a pessoa enviar o censo sem responder algo que existe,
          e o gráfico daquela pergunta ficaria vazio sem ninguém entender. */}
      <Modal
        visible={abrindo}
        animationType="slide"
        onRequestClose={() => setAbrindo(false)}
        statusBarTranslucent
        navigationBarTranslucent
      >
        {/* ⚠️ `Math.max` com um piso: se por qualquer razão o inset vier 0 (modal
            apresentado como sheet, aparelho sem notch, provider fora do ar), o
            X ficaria encostado na borda de cima. Piso pequeno não estraga o
            aparelho com notch (59 > 8) e salva o caso em que a medida falha. */}
        <TecladoSeguro
          style={[styles.modalSafe, { paddingTop: Math.max(insets.top, spacing.sm) }]}
        >
          {/* ⚠️ O título vem do servidor e é longo ("Censo CBRio 2026 · …"): sem
              `flex: 1` + `numberOfLines` ele empurrava o X pra fora e quebrava a
              barra em duas linhas. O X ganhou área de toque própria (44 dp) em
              vez de depender só do hitSlop. */}
          <View style={styles.modalHeader}>
            <Pressable
              onPress={() => setAbrindo(false)}
              hitSlop={12}
              style={styles.iconeToque}
              accessibilityRole="button"
              accessibilityLabel={t("Fechar")}
            >
              <Ionicons name="close" size={24} color={colors.text} />
            </Pressable>
            <Text style={styles.modalTitulo} numberOfLines={1}>
              {p?.titulo ?? t("Censo")}
            </Text>
            <View style={styles.iconeToque} />
          </View>

          {carregandoForm ? (
            <View style={styles.centro}><ActivityIndicator color={colors.primary} /></View>
          ) : erroForm ? (
            <View style={styles.centro}>
              <Text style={styles.titulo}>{t("Não consegui abrir o formulário")}</Text>
              <Text style={styles.texto}>{erroForm}</Text>
              {!!status?.url && (
                <Button title={t("Abrir no navegador")} onPress={() => abrirNaWeb()} />
              )}
            </View>
          ) : naoSuportados.length > 0 ? (
            <View style={styles.centro}>
              <Ionicons name="open-outline" size={30} color={colors.textMuted} />
              <Text style={styles.titulo}>{t("Este censo abre no navegador")}</Text>
              <Text style={styles.texto}>
                {t("Ele tem um tipo de pergunta que o app ainda não mostra. Para você não deixar nada em branco, respondemos pelo navegador.")}
              </Text>
              <Button title={t("Abrir no navegador")} onPress={() => abrirNaWeb()} />
            </View>
          ) : enviado ? (
            <View style={styles.centro}>
              <Ionicons name="checkmark-circle" size={38} color={colors.success} />
              <Text style={styles.titulo}>{t("Recebemos, obrigado!")}</Text>
              <Text style={styles.texto}>{t("Sua resposta foi registrada.")}</Text>
              <Button title={t("Fechar")} onPress={() => { setAbrindo(false); carregar(); }} />
            </View>
          ) : form ? (
            <FormCenso
              perguntas={form.perguntas}
              consentimentoTexto={form.consentimento_texto}
              valoresIniciais={valoresIniciais}
              enviando={enviando}
              erroEnvio={erroEnvio}
              onEnviar={enviarRespostas}
              folgaAbaixo={insets.bottom}
            />
          ) : null}
        </TecladoSeguro>
      </Modal>
    </SafeAreaView>
  );
}

function makeStyles(colors: Palette) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    modalSafe: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
    },
    headerTitle: { color: colors.text, fontSize: font.size.lg, fontWeight: "600" },
    scroll: { padding: spacing.lg, gap: spacing.md },
    centro: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      padding: spacing.xl,
      gap: spacing.sm,
    },
    card: { padding: spacing.lg, gap: spacing.sm, borderRadius: radius.lg, alignItems: "flex-start" },
    titulo: { color: colors.text, fontSize: font.size.lg, fontWeight: "700" },
    texto: { color: colors.textMuted, fontSize: font.size.md, lineHeight: 21 },
    rodape: { color: colors.textMuted, fontSize: font.size.sm, lineHeight: 19, opacity: 0.85 },

    // ── cabeçalho do modal do formulário ────────────────────────────────────
    // Barra própria, com borda embaixo: o formulário rola por baixo dela, e sem
    // a linha o título parecia flutuar no meio do conteúdo.
    modalHeader: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: spacing.sm,
      paddingBottom: spacing.sm,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    modalTitulo: {
      flex: 1,
      textAlign: "center",
      color: colors.text,
      fontSize: font.size.md,
      fontWeight: "600",
    },
    iconeToque: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },

    // Botão do cartão ocupa a largura toda: o card é `alignItems: flex-start`,
    // então sem isto ele encolhia até o tamanho do texto.
    acaoLarga: { alignSelf: "stretch", marginTop: spacing.xs },
  });
}
