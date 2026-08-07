// ============================================================================
// GERENCIAR GRUPO · tudo o que o líder faz, num lugar só (Marcos · 05/08/2026)
//
// Pedido dele: "gerenciar grupo, aqui temos que acertar muito nessa tela,
// precisamos trazer TODO gerenciamento de um grupo pra cá — aba de membros
// (podendo gerenciar quem é líder, ou em treinamento), registro de frequências
// (com comentários do líder e uma opção de pedir ajuda), aprovação de novos
// pedidos, saídas e transferências, estudos e opção de editar o grupo".
//
// ⚠️⚠️ LAYOUT v2 · HIERARQUIA VISUAL (05/08/2026 · aprovado pelo Marcos)
// A v1 tinha DOIS protagonistas: o nome do grupo (25/800) e os três números
// (25/800) empatados no topo da escala, mais teal em 4 papéis (botão + pílula da
// aba + 5 avatares). Ele apontou: "a pessoa que abre não vê um destaque nenhum
// muito claro". O conserto NÃO foi aumentar o herói — foi rebaixar os
// concorrentes:
//   ZONA 1 · AÇÃO    → o próximo encontro é o ÚNICO elemento em 27/800 e o único
//                      bloco com moldura. Muda de cor com o estado.
//   ZONA 2 · APOIO   → os 3 números viraram UMA linha de 13,5 px.
//   ZONA 3 · DETALHE → abas silenciosas (sublinhado, não pílula cheia) + lista
//                      com avatar NEUTRO, separadas por 26 px de respiro.
// O nome do grupo aparece UMA vez (na barra), com dia/local na 2ª linha.
// Sobrou UM teal saturado na tela: o botão do herói.
// ⚠️ O botão "Inscrições do grupo" saiu do /meu-grupo — aprovar pedido agora só
// existe AQUI (a aba Pedidos). Duas portas pra mesma coisa era o que confundia.
//
// ⚠️ FUNÇÃO: o app dá `frequentador`, `em treinamento` e `co-líder`. NÃO dá
// `líder` — quem lidera é `mem_grupos.lider_id`, e esse campo decide **quem
// recebe o WhatsApp do grupo** (lei de 31/07: um destinatário só, e tem que ser
// líder do roster). Trocar liderança é ato da coordenação, não do app.
// ⚠️ TRANSFERÊNCIA não empurra ninguém pra dentro de outro grupo: cria um PEDIDO
// pro líder de lá aprovar. E a SAÍDA é um passo separado, que o líder decide.
// ⚠️ FREQUÊNCIA usa a RPC `registrar_encontro_grupo` (o mesmo escritor do web e
// do fluxo do WhatsApp) — não existe segunda régua de presença.
// ============================================================================
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator, Alert, Linking, Modal, Platform,
  Pressable, RefreshControl, ScrollView, Share, StyleSheet, Text, TextInput, View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { useColors } from "@/contexts/ThemeContext";
import { useT } from "@/lib/i18n";
import { subirUmNivel } from "@/lib/hierarquia";
import { hojeBRT } from "@/lib/dataBRT";
import {
  estadoDoEncontro, dataLonga, quandoCurto, distanciaEmTexto,
} from "@/lib/proximoEncontro";
import { font, radius, spacing, type Palette } from "@/constants/theme";
import {
  getGrupoRoster, aprovarPedidoGrupo, recusarPedidoGrupo,
  mudarFuncaoMembroGrupo, registrarSaidaGrupo, transferirMembroGrupo,
  getEncontrosGrupo, registrarEncontroGrupo, pedirAjudaGrupo, getMateriaisGrupo,
  listarMeusGruposLider,
  type GrupoMembro, type GrupoPedido, type GrupoRoster,
  type GrupoEncontro, type GrupoMaterial, type FuncaoApp,
} from "@/lib/api";
import { TecladoSeguro } from "@/components/ui/TecladoSeguro";

type Aba = "membros" | "frequencia" | "pedidos" | "estudos";
// ⚠️ SEM ÍCONE e com rótulo curto: 4 abas em 328 dp dão ~80 dp cada, e ícone
// (16) + gap (4) comiam o texto — era isso que fazia "Frequência" estourar e
// "Estudos" encostar na borda. A referência (Mobbin/Fluent) diz o mesmo: não
// misturar texto e ícone no mesmo controle.
const ABAS: { k: Aba; label: string }[] = [
  { k: "membros", label: "Pessoas" },
  { k: "frequencia", label: "Encontros" },
  { k: "pedidos", label: "Pedidos" },
  { k: "estudos", label: "Estudos" },
];

const MESES_CURTOS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const FUNCAO: Record<string, string> = {
  lider: "Líder", co_lider: "Co-líder", colider: "Co-líder",
  lider_treinamento: "Em treinamento", supervisor: "Supervisor",
  coordenador: "Coordenador", membro: "Membro", frequentador: "Frequentador",
  visitante: "Visitante",
};
// ⚠️ `quando()` local e `DESTAQUE` saíram na v2: quem monta "Terça, 20h" agora é
// `quandoCurto` (lib/proximoEncontro · testado no portão), e o único selo da
// lista é "Principal" — dar badge colorido a todo papel era mais um chamariz
// competindo com o herói.
function waLink(tel: string | null): string | null {
  if (!tel) return null;
  let d = String(tel).replace(/\D/g, "");
  if (!d) return null;
  if (d.length <= 11 && !d.startsWith("55")) d = "55" + d;
  return `https://wa.me/${d}`;
}
function iniciais(nome: string): string {
  const p = (nome || "").trim().split(/\s+/).filter(Boolean);
  if (!p.length) return "?";
  return ((p[0][0] || "") + (p.length > 1 ? p[p.length - 1][0] : "")).toUpperCase();
}

export default function GrupoMembrosScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const router = useRouter();
  const t = useT();
  const params = useLocalSearchParams<{ id: string; nome?: string }>();
  const grupoId = String(params.id || "");

  const [data, setData] = useState<GrupoRoster | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [refrescando, setRefrescando] = useState(false);
  const [processandoId, setProcessandoId] = useState<string | null>(null);
  const [recusaAlvo, setRecusaAlvo] = useState<GrupoPedido | null>(null);
  const [motivo, setMotivo] = useState("");

  const [aba, setAba] = useState<Aba>("membros");
  // Membros · ações por participante
  const [acaoAlvo, setAcaoAlvo] = useState<GrupoMembro | null>(null);
  const [saidaAlvo, setSaidaAlvo] = useState<GrupoMembro | null>(null);
  const [saidaMotivo, setSaidaMotivo] = useState("");
  const [transferirAlvo, setTransferirAlvo] = useState<GrupoMembro | null>(null);
  const [meusGrupos, setMeusGrupos] = useState<{ id: string; nome: string }[]>([]);
  // Frequência
  const [encontros, setEncontros] = useState<GrupoEncontro[] | null>(null);
  const [chamadaAberta, setChamadaAberta] = useState(false);
  const [presentes, setPresentes] = useState<Set<string>>(new Set());
  const [tema, setTema] = useState("");
  const [comentario, setComentario] = useState("");
  const [salvandoChamada, setSalvandoChamada] = useState(false);
  // Ajuda
  const [ajudaAberta, setAjudaAberta] = useState(false);
  const [ajudaMsg, setAjudaMsg] = useState("");
  const [enviandoAjuda, setEnviandoAjuda] = useState(false);
  // Estudos
  const [materiais, setMateriais] = useState<GrupoMaterial[] | null>(null);

  const carregar = useCallback(async (silencioso = false) => {
    if (!silencioso) setErro(null);
    try {
      const r = await getGrupoRoster(grupoId);
      setData(r);
      setErro(null);
    } catch (e: any) {
      const status = (e as { status?: number })?.status;
      setErro(status === 403 ? t("Você não gerencia este grupo.") : (e?.message || t("Erro ao carregar o grupo.")));
      if (data === null) setData({ grupo: null as any, membros: [], pendentes: [] });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grupoId, t]);

  useFocusEffect(useCallback(() => { carregar(); }, [carregar]));

  // ⚠️ Cada aba puxa o SEU dado só quando é aberta — a tela de gerenciar tem 4
  // fontes e carregar as 4 no mount deixaria o líder esperando pelo que ele nem
  // vai olhar.
  // ⚠️ ENCONTROS saíram do lazy: o herói da tela (zona 1) precisa deles pra saber
  // se faltou registrar. Carregar só ao abrir a aba faria o herói afirmar
  // "próximo encontro" num grupo atrasado — dizer a coisa errada com confiança é
  // pior do que esperar 300 ms. `materiais` segue lazy (só a aba Estudos usa).
  useEffect(() => {
    if (encontros === null) {
      getEncontrosGrupo(grupoId).then((r) => setEncontros(r.encontros || [])).catch(() => setEncontros([]));
    }
    if (aba === "estudos" && materiais === null) {
      getMateriaisGrupo(grupoId).then((r) => setMateriais(r.materiais || [])).catch(() => setMateriais([]));
    }
  }, [aba, grupoId, encontros, materiais]);

  // Destinos possíveis da transferência = os grupos que ESTE líder gerencia
  // (mandar pra grupo de terceiro sem o líder de lá saber não é transferência,
  // é despejo — e mesmo aqui o destino recebe como PEDIDO).
  useEffect(() => {
    if (!transferirAlvo || meusGrupos.length) return;
    listarMeusGruposLider()
      .then((r) => setMeusGrupos((r.grupos || []).map((g) => ({ id: g.id, nome: g.nome }))))
      .catch(() => setMeusGrupos([]));
  }, [transferirAlvo, meusGrupos.length]);

  async function aplicarFuncao(m: GrupoMembro, funcao: FuncaoApp) {
    setAcaoAlvo(null);
    setProcessandoId(m.id);
    try {
      await mudarFuncaoMembroGrupo(grupoId, m.id, funcao);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      await carregar(true);
    } catch (e: any) {
      Alert.alert(t("Não deu"), e?.message || t("Não foi possível mudar a função."));
    } finally { setProcessandoId(null); }
  }

  async function confirmarSaida() {
    const m = saidaAlvo;
    if (!m) return;
    setProcessandoId(m.id);
    try {
      await registrarSaidaGrupo(grupoId, m.id, saidaMotivo.trim());
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setSaidaAlvo(null); setSaidaMotivo("");
      await carregar(true);
    } catch (e: any) {
      Alert.alert(t("Não deu"), e?.message || t("Não foi possível registrar a saída."));
    } finally { setProcessandoId(null); }
  }

  async function confirmarTransferencia(destinoId: string) {
    const m = transferirAlvo;
    if (!m) return;
    setProcessandoId(m.id);
    try {
      const r = await transferirMembroGrupo(grupoId, m.id, destinoId);
      setTransferirAlvo(null);
      Alert.alert(
        t("Pedido enviado"),
        r.ja_no_destino
          ? t("Essa pessoa já está no grupo de destino.")
          : r.ja_pedido
            ? t("Já existe um pedido dela nesse grupo, aguardando aprovação.")
            : `${t("O pedido foi pra fila de")} ${r.destino}. ${t("A saída deste grupo é um passo separado — você decide quando registrar.")}`
      );
    } catch (e: any) {
      Alert.alert(t("Não deu"), e?.message || t("Não foi possível pedir a transferência."));
    } finally { setProcessandoId(null); }
  }

  function abrirChamada() {
    // Começa com TODO MUNDO marcado: na prática o líder desmarca quem faltou, e
    // é bem menos toque do que marcar 12 pessoas uma a uma.
    setPresentes(new Set((data?.membros || []).map((m) => m.membro_id).filter(Boolean) as string[]));
    setTema(""); setComentario(""); setChamadaAberta(true);
  }

  async function salvarChamada() {
    setSalvandoChamada(true);
    try {
      const r = await registrarEncontroGrupo(grupoId, {
        tema: tema.trim() || undefined,
        observacoes: comentario.trim() || undefined,
        presentes: [...presentes],
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setChamadaAberta(false);
      setEncontros(null); // força recarregar o histórico
      await carregar(true); // o contador de presenças do roster mudou
      Alert.alert(t("Frequência registrada"), `${r.presentes} ${r.presentes === 1 ? t("presente") : t("presentes")}.`);
    } catch (e: any) {
      Alert.alert(t("Não deu"), e?.message || t("Não foi possível registrar."));
    } finally { setSalvandoChamada(false); }
  }

  async function enviarAjuda() {
    setEnviandoAjuda(true);
    try {
      await pedirAjudaGrupo(grupoId, ajudaMsg.trim());
      setAjudaAberta(false); setAjudaMsg("");
      Alert.alert(t("Enviado"), t("A coordenação de Grupos recebeu seu pedido e vai falar com você."));
    } catch (e: any) {
      Alert.alert(t("Não deu"), e?.message || t("Não foi possível enviar."));
    } finally { setEnviandoAjuda(false); }
  }

  async function refrescar() {
    setRefrescando(true);
    try { await carregar(true); } finally { setRefrescando(false); }
  }

  function aceitar(p: GrupoPedido) {
    Alert.alert(t("Aceitar inscrição"), `${t("Aprovar")} ${p.nome}?`, [
      { text: t("Cancelar"), style: "cancel" },
      {
        text: t("Aceitar"),
        onPress: async () => {
          setProcessandoId(p.id);
          try {
            await aprovarPedidoGrupo(p.id);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
            await carregar(true); // atualiza roster + pendentes
          } catch (e: any) {
            Alert.alert(t("Erro"), e?.message || t("Não foi possível aprovar."));
          } finally { setProcessandoId(null); }
        },
      },
    ]);
  }
  async function confirmarRecusa() {
    const p = recusaAlvo;
    if (!p) return;
    setProcessandoId(p.id);
    try {
      await recusarPedidoGrupo(p.id, motivo.trim());
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setRecusaAlvo(null); setMotivo("");
      await carregar(true);
    } catch (e: any) {
      Alert.alert(t("Erro"), e?.message || t("Não foi possível recusar."));
    } finally { setProcessandoId(null); }
  }

  const grupo = data?.grupo;
  // ⚠️ A líder PRINCIPAL é `mem_grupos.lider_id`, NÃO quem tem `funcao='lider'`
  // no roster: função é cadastro (vários podem ter, e nenhum recebe mensagem por
  // isso). Só a principal recebe o WhatsApp do grupo e por isso é a única
  // protegida aqui — antes a tela escondia as ações de todos os líderes.
  const liderPrincipalId = grupo?.lider_id || null;
  const membros = data?.membros || [];
  const pendentes = data?.pendentes || [];
  const nome = grupo?.nome || params.nome || t("Grupo");
  const quandoTxt = quandoCurto(grupo?.dia_semana, grupo?.horario);
  const ondeTxt = grupo?.local || grupo?.bairro || "";
  const subBarra = [quandoTxt, ondeTxt].filter(Boolean).join("  ·  ");

  // ── ZONA 1 · quem é o herói ────────────────────────────────────────────
  // ⚠️ `encontros === null` = ainda carregando: o herói NÃO afirma atraso nesse
  // instante (afirmar "faltou registrar" sem ter lido os encontros seria mentir
  // com confiança). Enquanto isso, mostra o próximo encontro.
  const heroPronto = encontros !== null;
  const estado = estadoDoEncontro({
    diaSemana: grupo?.dia_semana,
    encontros: (encontros || []).map((e) => ({ data: e.data, presentes: e.presentes })),
    hoje: hojeBRT(),
  });
  const semGente = membros.length === 0;

  // ── ZONA 2 · presença média (últimos 6 encontros ÷ roster ativo) ───────
  // Visitante faz `presentes` passar do nº de membros, então o teto é 100%.
  const ultimos = (encontros || []).slice(0, 6);
  const mediaPresentes = ultimos.length
    ? ultimos.reduce((s, e) => s + (e.presentes || 0), 0) / ultimos.length
    : null;
  const pctPresenca =
    mediaPresentes != null && membros.length
      ? Math.min(100, Math.round((mediaPresentes / membros.length) * 100))
      : null;

  async function convidar() {
    // ⚠️ O link público é o de INSCRIÇÃO EM GRUPOS (`/inscricao-grupos`), que não
    // aceita parâmetro de grupo — quem entra escolhe o grupo na lista. A mensagem
    // diz o nome pra pessoa achar o certo; inventar um `?grupo=` daria link morto.
    try {
      await Share.share({
        message: `${t("Vem pro nosso grupo de conexão")} "${nome}"${quandoTxt ? ` (${quandoTxt})` : ""}! ${t("Se inscreva aqui e escolha o nosso grupo na lista")}: https://cbrio.org/inscricao-grupos`,
      });
    } catch { /* a pessoa cancelou o compartilhamento */ }
  }

  /** Herói: rótulo, cor, texto grande, legenda e a ação que CABE no estado. */
  function heroi() {
    if (!heroPronto || estado.tipo === "sem_dia") {
      return {
        variante: "normal" as const,
        icone: "time-outline" as const,
        rotulo: t("Encontro do grupo"),
        grande: quandoTxt || t("Sem dia definido"),
        legenda: heroPronto
          ? t("Registre quando o grupo se reunir")
          : t("Carregando os encontros…"),
        acao: semGente ? ("convidar" as const) : ("chamada" as const),
      };
    }
    if (estado.tipo === "atrasado") {
      return {
        variante: "atencao" as const,
        icone: "alert-circle-outline" as const,
        rotulo: t("Faltou registrar"),
        grande: dataLonga(estado.data),
        legenda: `${distanciaEmTexto(-estado.dias)} · ${t("sem isso a coordenação não vê a frequência")}`,
        acao: "chamada" as const,
      };
    }
    if (estado.tipo === "registrado") {
      const total = membros.length;
      return {
        variante: "feito" as const,
        icone: "checkmark-circle-outline" as const,
        rotulo: t("Encontro registrado"),
        grande:
          estado.presentes != null
            ? `${estado.presentes}${total ? ` ${t("de")} ${total}` : ""} ${estado.presentes === 1 ? t("presente") : t("presentes")}`
            : dataLonga(estado.data),
        legenda: `${dataLonga(estado.data)}${estado.proxima ? ` · ${t("próximo")}: ${dataLonga(estado.proxima)}` : ""}`,
        // ⚠️ Quando nada é preciso, nada grita: a ação vira secundária.
        acao: "ver" as const,
      };
    }
    return {
      variante: "normal" as const,
      icone: "time-outline" as const,
      rotulo: semGente ? t("Primeiro encontro") : t("Próximo encontro"),
      grande: dataLonga(estado.data),
      legenda: semGente
        ? `${quandoTxt ? quandoTxt.split(", ")[1] || "" : ""} ${t("· comece convidando as pessoas")}`.trim()
        : [quandoTxt.split(", ")[1], distanciaEmTexto(estado.dias)].filter(Boolean).join(" · "),
      acao: semGente ? ("convidar" as const) : ("chamada" as const),
    };
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* ── barra de cima: o nome vive AQUI (uma vez), com dia/local embaixo ── */}
      <View style={styles.header}>
        <Pressable onPress={() => subirUmNivel()} hitSlop={12} style={styles.hIcone} accessibilityRole="button" accessibilityLabel={t("Voltar")}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </Pressable>
        <View style={styles.hMeio}>
          <Text style={styles.hNome} numberOfLines={1}>{nome}</Text>
          {!!subBarra && <Text style={styles.hSub} numberOfLines={1}>{subBarra}</Text>}
        </View>
        {/* ⚠️ EDITAR fica no cabeçalho, não como aba: é a única ação que abre
            OUTRA tela (/grupo-editar, que já existia e trata endereço, dia,
            categoria e foto). Virar aba daria a impressão de que o formulário
            está aqui dentro. */}
        <Pressable
          onPress={() => router.navigate({ pathname: "/grupo-editar", params: { id: grupoId } } as never)}
          hitSlop={12}
          style={styles.hIcone}
          accessibilityRole="button"
          accessibilityLabel={t("Editar grupo")}
        >
          <Ionicons name="create-outline" size={23} color={colors.text} />
        </Pressable>
      </View>

      {data === null ? (
        <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>
      ) : (
        <ScrollView
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
          contentContainerStyle={styles.scroll}
          refreshControl={<RefreshControl refreshing={refrescando} onRefresh={refrescar} tintColor={colors.primary}/>}
        >
          {erro && !grupo ? (
            <View style={[styles.center, { paddingTop: spacing.xl }]}>
              <Ionicons name="lock-closed-outline" size={32} color={colors.textMuted} />
              <Text style={styles.muted}>{erro}</Text>
            </View>
          ) : (
            <>
              {/* ═══════════ ZONA 1 · AÇÃO (o único protagonista) ═══════════ */}
              {(() => {
                const h = heroi();
                return (
                  <View style={[styles.hero, h.variante === "atencao" && styles.heroAtencao, h.variante === "feito" && styles.heroFeito]}>
                    <View style={styles.heroRot}>
                      <Ionicons
                        name={h.icone}
                        size={14}
                        color={h.variante === "atencao" ? colors.warning : h.variante === "feito" ? colors.success : colors.brandMid}
                      />
                      <Text
                        style={[
                          styles.heroRotTxt,
                          h.variante === "atencao" && { color: colors.warning },
                          h.variante === "feito" && { color: colors.success },
                        ]}
                      >
                        {h.rotulo}
                      </Text>
                    </View>
                    <View>
                      <Text style={styles.heroGrande}>{h.grande}</Text>
                      {!!h.legenda && <Text style={styles.heroSub}>{h.legenda}</Text>}
                    </View>
                    {h.acao === "convidar" ? (
                      <Pressable style={[styles.heroBtn, styles.heroBtnCheio]} onPress={convidar} accessibilityRole="button">
                        <Ionicons name="logo-whatsapp" size={18} color="#fff" />
                        <Text style={styles.heroBtnTxt}>{t("Convidar pelo WhatsApp")}</Text>
                      </Pressable>
                    ) : h.acao === "ver" ? (
                      <Pressable style={[styles.heroBtn, styles.heroBtnGhost]} onPress={() => setAba("frequencia")} accessibilityRole="button">
                        <Ionicons name="list-outline" size={18} color={colors.text} />
                        <Text style={[styles.heroBtnTxt, { color: colors.text }]}>{t("Ver os encontros")}</Text>
                      </Pressable>
                    ) : (
                      <Pressable
                        style={[styles.heroBtn, h.variante === "atencao" ? styles.heroBtnAtencao : styles.heroBtnCheio]}
                        onPress={abrirChamada}
                        disabled={semGente}
                        accessibilityRole="button"
                      >
                        <Ionicons name="checkmark-circle" size={18} color={h.variante === "atencao" ? "#22160A" : "#fff"} />
                        <Text style={[styles.heroBtnTxt, h.variante === "atencao" && { color: "#22160A" }]}>
                          {h.variante === "atencao" ? t("Registrar agora") : t("Registrar presença")}
                        </Text>
                      </Pressable>
                    )}
                  </View>
                );
              })()}

              {/* ═══════════ ZONA 2 · APOIO (era 3 × 25/800) ═══════════ */}
              <View style={styles.apoio}>
                <Text style={styles.apoioTxt} numberOfLines={1}>
                  {semGente ? (
                    t("Nenhum membro ainda")
                  ) : (
                    <>
                      <Text style={styles.apoioNum}>{membros.length}</Text>
                      {` ${membros.length === 1 ? t("membro") : t("membros")}`}
                      {pctPresenca != null && (
                        <>
                          {"   ·   "}
                          <Text style={styles.apoioNum}>{pctPresenca}%</Text>
                          {` ${t("de presença")}`}
                        </>
                      )}
                    </>
                  )}
                </Text>
                {pendentes.length > 0 && (
                  <Pressable style={styles.pastilha} onPress={() => setAba("pedidos")} accessibilityRole="button">
                    <Text style={styles.pastilhaTxt}>
                      {pendentes.length} {pendentes.length === 1 ? t("pedido") : t("pedidos")}
                    </Text>
                  </Pressable>
                )}
              </View>

              {/* ═══════════ ZONA 3 · DETALHE (26 dp de respiro acima) ═══════════ */}
              <View style={styles.zona3}>
                {/* abas silenciosas: trilho de 1 px + sublinhado de 2 px */}
                <View style={styles.abasRow}>
                  {ABAS.map((op) => {
                    const sel = aba === op.k;
                    const badge = op.k === "pedidos" ? pendentes.length : 0;
                    return (
                      <Pressable
                        key={op.k}
                        onPress={() => setAba(op.k)}
                        style={styles.abaBtn}
                        accessibilityRole="tab"
                        accessibilityState={{ selected: sel }}
                      >
                        <View style={styles.abaConteudo}>
                          <Text style={[styles.abaTxt, sel && styles.abaTxtAtiva]} numberOfLines={1}>{t(op.label)}</Text>
                          {badge > 0 && <Text style={styles.abaBadgeTxt}>{badge}</Text>}
                        </View>
                        {sel && <View style={styles.abaMarca} />}
                      </Pressable>
                    );
                  })}
                </View>

                {/* ─── PEDIDOS ─── */}
                {aba === "pedidos" && (
                  pendentes.length === 0 ? (
                    <View style={styles.vazio}>
                      <Text style={styles.vazioTit}>{t("Nenhum pedido esperando")}</Text>
                      <Text style={styles.vazioTxt}>{t("Quando alguém se inscrever no seu grupo, aparece aqui e você recebe um WhatsApp.")}</Text>
                    </View>
                  ) : (
                    <>
                      <Text style={styles.secLabel}>{t("Esperando você")}</Text>
                      {pendentes.map((p) => {
                        const wa = waLink(p.telefone);
                        const proc = processandoId === p.id;
                        return (
                          <View key={p.id} style={styles.pedido}>
                            <View style={styles.pedidoTopo}>
                              <View style={styles.avatarSm}><Text style={styles.avatarSmTxt}>{iniciais(p.nome)}</Text></View>
                              <View style={{ flex: 1 }}>
                                <Text style={styles.nome} numberOfLines={1}>{p.nome}</Text>
                                {p.telefone ? <Text style={styles.pequeno} numberOfLines={1}>{p.telefone}</Text> : p.email ? <Text style={styles.pequeno} numberOfLines={1}>{p.email}</Text> : null}
                              </View>
                              {wa ? (
                                <Pressable onPress={() => Linking.openURL(wa)} hitSlop={8} accessibilityRole="button" accessibilityLabel={`${t("WhatsApp")} ${p.nome}`}>
                                  <Ionicons name="logo-whatsapp" size={22} color="#25D366" />
                                </Pressable>
                              ) : null}
                            </View>
                            {/* ⚠️ O fluxo certo é LIGAR antes de decidir (pedido do
                                Pr. Nélio, no template do WhatsApp) — e recusar aqui
                                DEVOLVE pra triagem, não avisa a pessoa. */}
                            <Text style={styles.pequeno}>{t("Ligue antes de decidir — recusar devolve pra coordenação realocar.")}</Text>
                            <View style={styles.acoes}>
                              <Pressable style={[styles.btn, styles.btnRecusar]} disabled={proc} onPress={() => { setRecusaAlvo(p); setMotivo(""); }} accessibilityRole="button">
                                <Ionicons name="close" size={18} color={colors.danger} />
                                <Text style={[styles.btnTxt, { color: colors.danger }]}>{t("Recusar")}</Text>
                              </Pressable>
                              <Pressable style={[styles.btn, styles.btnAceitar]} disabled={proc} onPress={() => aceitar(p)} accessibilityRole="button">
                                {proc ? <ActivityIndicator color="#fff" size="small" /> : (
                                  <><Ionicons name="checkmark" size={18} color="#fff" /><Text style={[styles.btnTxt, { color: "#fff" }]}>{t("Aceitar")}</Text></>
                                )}
                              </Pressable>
                            </View>
                          </View>
                        );
                      })}
                    </>
                  )
                )}

                {/* ─── PESSOAS ─── */}
                {aba === "membros" && (
                  semGente ? (
                    <>
                      <View style={styles.vazio}>
                        <Text style={styles.vazioTit}>{t("Ninguém no grupo ainda")}</Text>
                        <Text style={styles.vazioTxt}>{t("Quem pedir para entrar aparece em Pedidos, e você recebe um WhatsApp.")}</Text>
                      </View>
                      <Pressable style={styles.discreta} onPress={convidar} accessibilityRole="button">
                        <Ionicons name="person-add-outline" size={17} color={colors.textMuted} />
                        <Text style={styles.discretaTxt}>{t("Convidar alguém pelo WhatsApp")}</Text>
                      </Pressable>
                    </>
                  ) : (
                    <>
                      {membros.map((m: GrupoMembro) => {
                        const wa = waLink(m.telefone);
                        const fLabel = m.funcao ? (FUNCAO[m.funcao] || null) : null;
                        const ehPrincipal = !!m.membro_id && !!liderPrincipalId && m.membro_id === liderPrincipalId;
                        const detalhe = [
                          ehPrincipal ? t("Recebe os avisos no WhatsApp") : fLabel ? t(fLabel) : null,
                          m.presencas != null ? `${m.presencas} ${m.presencas === 1 ? t("presença") : t("presenças")}` : null,
                        ].filter(Boolean).join(" · ");
                        return (
                          <View key={m.id} style={styles.linha}>
                            {/* avatar NEUTRO: 5 círculos teal eram 5 chamarizes —
                                o olho tem que ler NOMES, não bolinhas. */}
                            <View style={styles.avatarSm}><Text style={styles.avatarSmTxt}>{iniciais(m.nome)}</Text></View>
                            <View style={{ flex: 1, minWidth: 0 }}>
                              <Text style={styles.nome} numberOfLines={1}>{m.nome}</Text>
                              {!!detalhe && <Text style={styles.pequeno} numberOfLines={1}>{detalhe}</Text>}
                            </View>
                            {ehPrincipal && (
                              <View style={styles.papelBadge}><Text style={styles.papelTxt}>{t("Principal")}</Text></View>
                            )}
                            {wa ? (
                              <Pressable onPress={() => Linking.openURL(wa)} hitSlop={8} accessibilityRole="button" accessibilityLabel={`${t("WhatsApp")} ${m.nome}`}>
                                <Ionicons name="logo-whatsapp" size={21} color="#25D366" />
                              </Pressable>
                            ) : null}
                            {/* ⚠️ Só a LÍDER PRINCIPAL não tem menu: mudar a função
                                ou registrar a saída dela mexeria em quem recebe o
                                WhatsApp do grupo, e isso é da coordenação. Os
                                outros líderes (cadastro) têm as ações normais. */}
                            {!ehPrincipal && (
                              <Pressable onPress={() => setAcaoAlvo(m)} hitSlop={8} accessibilityRole="button" accessibilityLabel={`${t("Opções de")} ${m.nome}`}>
                                {processandoId === m.id
                                  ? <ActivityIndicator size="small" color={colors.primary} />
                                  : <Ionicons name="ellipsis-vertical" size={19} color={colors.textMuted} />}
                              </Pressable>
                            )}
                          </View>
                        );
                      })}
                      <Pressable style={styles.discreta} onPress={convidar} accessibilityRole="button">
                        <Ionicons name="person-add-outline" size={17} color={colors.textMuted} />
                        <Text style={styles.discretaTxt}>{t("Convidar alguém pelo WhatsApp")}</Text>
                      </Pressable>
                    </>
                  )
                )}

                {/* ─── ENCONTROS ─── */}
                {aba === "frequencia" && (
                  <>
                    {encontros === null ? (
                      <View style={{ paddingVertical: spacing.lg }}><ActivityIndicator color={colors.primary} /></View>
                    ) : encontros.length === 0 ? (
                      <View style={styles.vazio}>
                        <Text style={styles.vazioTit}>{t("Nenhum encontro registrado")}</Text>
                        <Text style={styles.vazioTxt}>{t("Ao registrar, a coordenação passa a ver a frequência do grupo.")}</Text>
                      </View>
                    ) : (
                      <>
                        <Text style={styles.secLabel}>{t("Últimos encontros")}</Text>
                        {encontros.map((e) => {
                          const [ano, mes, dia] = String(e.data).split("-");
                          return (
                            <View key={e.id} style={styles.evento}>
                              <View style={styles.eventoData}>
                                <Text style={styles.eventoDia}>{dia}</Text>
                                <Text style={styles.eventoMes}>{MESES_CURTOS[Number(mes) - 1] || mes}</Text>
                              </View>
                              <View style={{ flex: 1, gap: 3 }}>
                                <Text style={styles.eventoPres}>
                                  <Text style={styles.eventoPresN}>{e.presentes}</Text>
                                  {membros.length ? ` ${t("de")} ${membros.length}` : ""}
                                  {` ${e.presentes === 1 ? t("presente") : t("presentes")}`}
                                </Text>
                                {!!e.tema && <Text style={styles.eventoTema}>{e.tema}</Text>}
                                {!!e.observacoes && <Text style={styles.eventoObs}>{e.observacoes}</Text>}
                                {!!e.registrado_por_nome && <Text style={styles.pequeno}>{t("por")} {e.registrado_por_nome}</Text>}
                              </View>
                            </View>
                          );
                        })}
                      </>
                    )}
                    {/* ⚠️ "Preciso de ajuda" é ação RARA: linha discreta no rodapé,
                        não card do tamanho do botão principal. Card com seta do
                        mesmo peso é o que faz tudo parecer igualmente importante. */}
                    <Pressable style={styles.discreta} onPress={() => { setAjudaMsg(""); setAjudaAberta(true); }} accessibilityRole="button">
                      <Ionicons name="help-buoy-outline" size={17} color={colors.textMuted} />
                      <Text style={[styles.discretaTxt, { flex: 1 }]}>{t("Preciso de ajuda com o grupo")}</Text>
                      <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                    </Pressable>
                  </>
                )}

                {/* ─── ESTUDOS ─── */}
                {aba === "estudos" && (
                  materiais === null ? (
                    <View style={{ paddingVertical: spacing.lg }}><ActivityIndicator color={colors.primary} /></View>
                  ) : materiais.length === 0 ? (
                    <View style={styles.vazio}>
                      <Text style={styles.vazioTit}>{t("Nenhum estudo publicado")}</Text>
                      <Text style={styles.vazioTxt}>{t("A coordenação publica os materiais no sistema e eles aparecem aqui.")}</Text>
                    </View>
                  ) : (
                    <>
                      <Text style={styles.secLabel}>{t("Material do grupo")}</Text>
                      {materiais.map((mt) => (
                        <Pressable
                          key={mt.id}
                          style={styles.linha}
                          disabled={!mt.url}
                          onPress={() => mt.url && Linking.openURL(mt.url)}
                          accessibilityRole="button"
                        >
                          <View style={styles.avatarDoc}>
                            <Ionicons name={mt.estudo_semana ? "bookmark" : "document-text-outline"} size={18} color={colors.textMuted} />
                          </View>
                          <View style={{ flex: 1, minWidth: 0 }}>
                            <Text style={styles.nome} numberOfLines={2}>{mt.nome}</Text>
                            {(mt.etiquetas || []).length > 0 && (
                              <Text style={styles.pequeno} numberOfLines={1}>{(mt.etiquetas || []).join(", ")}</Text>
                            )}
                          </View>
                          {mt.estudo_semana && (
                            <View style={styles.papelBadge}><Text style={styles.papelTxt}>{t("Da semana")}</Text></View>
                          )}
                          {mt.url ? <Ionicons name="chevron-forward" size={16} color={colors.textMuted} /> : null}
                        </Pressable>
                      ))}
                    </>
                  )
                )}
              </View>
            </>
          )}
        </ScrollView>
      )}

      {/* ═══ Ações do participante (função · transferir · saída) ═══ */}
      <Modal visible={!!acaoAlvo} animationType="slide" transparent statusBarTranslucent onRequestClose={() => setAcaoAlvo(null)}>
        <Pressable style={styles.modalWrap} onPress={() => setAcaoAlvo(null)}>
          <Pressable style={[styles.sheet, { paddingBottom: spacing.md + insets.bottom }]} onPress={(e) => e.stopPropagation()}>
            <View style={styles.sheetHead}>
              <Text style={styles.sheetTitle} numberOfLines={1}>{acaoAlvo?.nome}</Text>
              <Pressable onPress={() => setAcaoAlvo(null)} hitSlop={12} accessibilityRole="button" accessibilityLabel={t("Fechar")}>
                <Ionicons name="close" size={24} color={colors.text} />
              </Pressable>
            </View>

            <Text style={styles.sheetLabel}>{t("Função no grupo")}</Text>
            {([
              { v: "frequentador" as FuncaoApp, l: "Frequentador", i: "person-outline" as const },
              { v: "lider_treinamento" as FuncaoApp, l: "Líder em treinamento", i: "school-outline" as const },
              { v: "co_lider" as FuncaoApp, l: "Co-líder", i: "people-circle-outline" as const },
              // ⚠️ "Líder" aqui é CADASTRO (podem ser vários) — quem recebe as
              // mensagens do grupo é só a líder PRINCIPAL (`mem_grupos.lider_id`),
              // e ela nem aparece com este menu. Marcar alguém como líder aqui
              // NÃO faz o WhatsApp do grupo passar a ir pra essa pessoa.
              { v: "lider" as FuncaoApp, l: "Líder (cadastro)", i: "star-outline" as const },
            ]).map((op) => {
              const atual = acaoAlvo?.funcao === op.v || (op.v === "co_lider" && acaoAlvo?.funcao === "colider");
              return (
                <Pressable key={op.v} style={styles.acaoItem} disabled={atual} onPress={() => acaoAlvo && aplicarFuncao(acaoAlvo, op.v)} accessibilityRole="button">
                  <Ionicons name={op.i} size={20} color={atual ? colors.primary : colors.text} />
                  <Text style={[styles.acaoTxt, atual && { color: colors.primary }]}>{t(op.l)}</Text>
                  {atual && <Ionicons name="checkmark" size={18} color={colors.primary} />}
                </Pressable>
              );
            })}
            {/* ⚠️ A distinção que o Marcos pediu (05/08): marcar líder aqui é
                CADASTRO — a mensagem do grupo continua indo só pra principal. */}
            <Text style={styles.pequeno}>
              {t("Marcar como líder aqui é só pro cadastro do grupo — as mensagens do grupo no WhatsApp continuam indo só pra líder principal. Trocar quem é a principal é com a coordenação.")}
            </Text>

            <View style={{ height: 1, backgroundColor: colors.border, marginVertical: spacing.sm }} />

            <Pressable style={styles.acaoItem} onPress={() => { const m = acaoAlvo; setAcaoAlvo(null); setTransferirAlvo(m); }} accessibilityRole="button">
              <Ionicons name="swap-horizontal-outline" size={20} color={colors.text} />
              <Text style={styles.acaoTxt}>{t("Transferir para outro grupo")}</Text>
            </Pressable>
            <Pressable style={styles.acaoItem} onPress={() => { const m = acaoAlvo; setAcaoAlvo(null); setSaidaMotivo(""); setSaidaAlvo(m); }} accessibilityRole="button">
              <Ionicons name="exit-outline" size={20} color={colors.danger} />
              <Text style={[styles.acaoTxt, styles.acaoTxtPerigo]}>{t("Registrar saída do grupo")}</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ═══ Saída ═══ */}
      <Modal visible={!!saidaAlvo} animationType="slide" transparent statusBarTranslucent onRequestClose={() => setSaidaAlvo(null)}>
        <TecladoSeguro style={styles.modalWrap}>
          <View style={[styles.sheet, { paddingBottom: spacing.md + insets.bottom }]}>
            <View style={styles.sheetHead}>
              <Text style={styles.sheetTitle}>{t("Registrar saída")}</Text>
              <Pressable onPress={() => setSaidaAlvo(null)} hitSlop={12} accessibilityRole="button" accessibilityLabel={t("Fechar")}>
                <Ionicons name="close" size={24} color={colors.text} />
              </Pressable>
            </View>
            {saidaAlvo && <Text style={[styles.muted, { marginBottom: spacing.xs }]}>{saidaAlvo.nome} {t("sai deste grupo?")}</Text>}
            {/* Saída é reversível e não apaga ninguém — a pessoa continua no
                sistema e pode entrar de novo (mesma régua do "confira a lista"). */}
            <Text style={[styles.muted, { marginBottom: spacing.sm }]}>
              {t("A pessoa continua cadastrada e pode voltar depois. Ela não recebe aviso automático.")}
            </Text>
            <Text style={styles.sheetLabel}>{t("Motivo (opcional)")}</Text>
            <TextInput
              style={styles.input}
              placeholder={t("Ex.: mudou de bairro, entrou em outro grupo…")}
              placeholderTextColor={colors.textMuted}
              value={saidaMotivo}
              onChangeText={setSaidaMotivo}
              multiline
            />
            <Pressable style={[styles.btn, styles.btnRecusarSolido, { marginTop: spacing.md }]} disabled={!!processandoId} onPress={confirmarSaida} accessibilityRole="button">
              {processandoId ? <ActivityIndicator color="#fff" size="small" /> : <Text style={[styles.btnTxt, { color: "#fff" }]}>{t("Confirmar saída")}</Text>}
            </Pressable>
          </View>
        </TecladoSeguro>
      </Modal>

      {/* ═══ Transferência ═══ */}
      <Modal visible={!!transferirAlvo} animationType="slide" transparent statusBarTranslucent onRequestClose={() => setTransferirAlvo(null)}>
        <Pressable style={styles.modalWrap} onPress={() => setTransferirAlvo(null)}>
          <Pressable style={[styles.sheet, { paddingBottom: spacing.md + insets.bottom }]} onPress={(e) => e.stopPropagation()}>
            <View style={styles.sheetHead}>
              <Text style={styles.sheetTitle}>{t("Transferir")}</Text>
              <Pressable onPress={() => setTransferirAlvo(null)} hitSlop={12} accessibilityRole="button" accessibilityLabel={t("Fechar")}>
                <Ionicons name="close" size={24} color={colors.text} />
              </Pressable>
            </View>
            {/* ⚠️ Não empurra ninguém: vira PEDIDO na fila do grupo de destino. */}
            <Text style={[styles.muted, { marginBottom: spacing.sm }]}>
              {transferirAlvo?.nome} {t("vai como PEDIDO para o grupo escolhido — o líder de lá aprova. A saída deste grupo é um passo separado.")}
            </Text>
            {meusGrupos.filter((g) => g.id !== grupoId).length === 0 ? (
              <Text style={styles.muted}>{t("Você gerencia só este grupo. Para transferir pra um grupo de outro líder, fale com a coordenação.")}</Text>
            ) : (
              meusGrupos.filter((g) => g.id !== grupoId).map((g) => (
                <Pressable key={g.id} style={styles.acaoItem} disabled={!!processandoId} onPress={() => confirmarTransferencia(g.id)} accessibilityRole="button">
                  <Ionicons name="people-outline" size={20} color={colors.text} />
                  <Text style={styles.acaoTxt} numberOfLines={1}>{g.nome}</Text>
                </Pressable>
              ))
            )}
          </Pressable>
        </Pressable>
      </Modal>

      {/* ═══ Chamada (frequência) ═══ */}
      <Modal visible={chamadaAberta} animationType="slide" transparent statusBarTranslucent onRequestClose={() => setChamadaAberta(false)}>
        <TecladoSeguro style={styles.modalWrap}>
          <View style={[styles.sheet, { paddingBottom: spacing.md + insets.bottom, maxHeight: "88%" }]}>
            <View style={styles.sheetHead}>
              <Text style={styles.sheetTitle}>{t("Frequência de hoje")}</Text>
              <Pressable onPress={() => setChamadaAberta(false)} hitSlop={12} accessibilityRole="button" accessibilityLabel={t("Fechar")}>
                <Ionicons name="close" size={24} color={colors.text} />
              </Pressable>
            </View>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              automaticallyAdjustKeyboardInsets
              style={{ maxHeight: 320 }}>
              {/* Todos começam MARCADOS — o líder desmarca quem faltou (bem menos
                  toque do que marcar 12 pessoas). */}
              {membros.map((m) => {
                const mid = m.membro_id;
                if (!mid) return null;
                const on = presentes.has(mid);
                return (
                  <Pressable
                    key={m.id}
                    style={styles.chamadaLinha}
                    onPress={() => setPresentes((s) => { const n = new Set(s); if (on) n.delete(mid); else n.add(mid); return n; })}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: on }}
                  >
                    <Ionicons name={on ? "checkbox" : "square-outline"} size={22} color={on ? colors.primary : colors.textMuted} />
                    <Text style={styles.chamadaNome} numberOfLines={1}>{m.nome}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            <Text style={styles.sheetLabel}>{t("Tema do encontro (opcional)")}</Text>
            <TextInput style={styles.input} placeholder={t("Ex.: Estudo 3 — Perdão")} placeholderTextColor={colors.textMuted} value={tema} onChangeText={setTema} />
            <Text style={styles.sheetLabel}>{t("Comentário do líder (opcional)")}</Text>
            <TextInput
              style={styles.input}
              placeholder={t("Como foi o encontro? Algo que a coordenação precisa saber?")}
              placeholderTextColor={colors.textMuted}
              value={comentario}
              onChangeText={setComentario}
              multiline
            />
            <Pressable style={[styles.btn, styles.btnAceitar, { marginTop: spacing.md }]} disabled={salvandoChamada} onPress={salvarChamada} accessibilityRole="button">
              {salvandoChamada ? <ActivityIndicator color="#fff" size="small" /> : (
                <Text style={[styles.btnTxt, { color: "#fff" }]}>
                  {t("Salvar")} · {presentes.size} {presentes.size === 1 ? t("presente") : t("presentes")}
                </Text>
              )}
            </Pressable>
          </View>
        </TecladoSeguro>
      </Modal>

      {/* ═══ Pedir ajuda ═══ */}
      <Modal visible={ajudaAberta} animationType="slide" transparent statusBarTranslucent onRequestClose={() => setAjudaAberta(false)}>
        <TecladoSeguro style={styles.modalWrap}>
          <View style={[styles.sheet, { paddingBottom: spacing.md + insets.bottom }]}>
            <View style={styles.sheetHead}>
              <Text style={styles.sheetTitle}>{t("Preciso de ajuda")}</Text>
              <Pressable onPress={() => setAjudaAberta(false)} hitSlop={12} accessibilityRole="button" accessibilityLabel={t("Fechar")}>
                <Ionicons name="close" size={24} color={colors.text} />
              </Pressable>
            </View>
            <Text style={[styles.muted, { marginBottom: spacing.sm }]}>
              {t("A coordenação de Grupos recebe seu pedido com o nome do grupo e fala com você.")}
            </Text>
            <TextInput
              style={styles.input}
              placeholder={t("Ex.: preciso de apoio com uma situação no grupo…")}
              placeholderTextColor={colors.textMuted}
              value={ajudaMsg}
              onChangeText={setAjudaMsg}
              multiline
            />
            <Pressable style={[styles.btn, styles.btnAceitar, { marginTop: spacing.md }]} disabled={enviandoAjuda || ajudaMsg.trim().length < 5} onPress={enviarAjuda} accessibilityRole="button">
              {enviandoAjuda ? <ActivityIndicator color="#fff" size="small" /> : <Text style={[styles.btnTxt, { color: "#fff" }]}>{t("Enviar pedido")}</Text>}
            </Pressable>
          </View>
        </TecladoSeguro>
      </Modal>

    </SafeAreaView>
  );
}

function makeStyles(c: Palette) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.background },
    scroll: { paddingHorizontal: spacing.md, paddingTop: spacing.xs, paddingBottom: 40 },
    center: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.lg, gap: spacing.md },
    muted: { color: c.textMuted, fontSize: font.size.md, textAlign: "center" },
    pequeno: { color: c.textMuted, fontSize: 12.5 },

    // ── barra de cima · 2 linhas: o nome do grupo aparece UMA vez no app ───
    header: { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.xs, paddingTop: 2, paddingBottom: spacing.md },
    hIcone: { width: 40, alignItems: "center", justifyContent: "center" },
    hMeio: { flex: 1, alignItems: "center", gap: 1, paddingHorizontal: 2 },
    hNome: { color: c.text, fontSize: 16, fontWeight: "700", letterSpacing: -0.2 },
    hSub: { color: c.textMuted, fontSize: 11.5 },

    // ═══ ZONA 1 · o ÚNICO bloco com moldura e o único 27/800 da tela ══════
    hero: {
      backgroundColor: c.primary + "22",
      borderWidth: 1, borderColor: c.brandMid + "5C",
      borderRadius: 22, padding: spacing.md, gap: 13,
    },
    heroAtencao: { backgroundColor: c.warning + "22", borderColor: c.warning + "70" },
    heroFeito: { backgroundColor: c.success + "1F", borderColor: c.success + "66" },
    heroRot: { flexDirection: "row", alignItems: "center", gap: 6 },
    heroRotTxt: { color: c.brandMid, fontSize: 10.5, fontWeight: "800", textTransform: "uppercase", letterSpacing: 1.1 },
    heroGrande: { color: c.text, fontSize: 27, fontWeight: "800", letterSpacing: -0.7, lineHeight: 31 },
    heroSub: { color: c.textMuted, fontSize: 13.5, marginTop: 3 },
    heroBtn: {
      flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
      minHeight: 48, borderRadius: 14, paddingHorizontal: spacing.md,
    },
    heroBtnCheio: { backgroundColor: c.primary },
    heroBtnAtencao: { backgroundColor: c.warning },
    heroBtnGhost: { borderWidth: 1, borderColor: c.glassBorder },
    heroBtnTxt: { color: "#fff", fontSize: 15.5, fontWeight: "700" },

    // ═══ ZONA 2 · os números como linha de apoio (eram 3 × 25/800) ════════
    apoio: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingTop: 13, paddingHorizontal: 4 },
    apoioTxt: { flex: 1, color: c.textMuted, fontSize: 13.5 },
    apoioNum: { color: c.text, fontWeight: "700" },
    pastilha: {
      backgroundColor: c.warning + "29", borderWidth: 1, borderColor: c.warning + "66",
      borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 5,
    },
    pastilhaTxt: { color: c.warning, fontSize: 12.5, fontWeight: "700" },

    // ═══ ZONA 3 · o respiro de 26 dp é o que separa as zonas ══════════════
    zona3: { marginTop: 26 },
    abasRow: { flexDirection: "row", borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border },
    abaBtn: { flex: 1, minHeight: 40, justifyContent: "flex-end", alignItems: "center" },
    abaConteudo: { flexDirection: "row", alignItems: "center", gap: 4, paddingBottom: 9 },
    abaTxt: { color: c.textMuted, fontSize: 13.5, fontWeight: "600" },
    abaTxtAtiva: { color: c.text, fontWeight: "700" },
    abaBadgeTxt: { color: c.warning, fontSize: 11, fontWeight: "800" },
    abaMarca: { position: "absolute", bottom: -StyleSheet.hairlineWidth, left: 6, right: 6, height: 2, borderRadius: 2, backgroundColor: c.primary },

    secLabel: { color: c.textMuted, fontSize: 10.5, fontWeight: "800", textTransform: "uppercase", letterSpacing: 1.2, paddingTop: 14, paddingBottom: 2 },

    // listas sem borda: só separador (a moldura é privilégio do herói)
    linha: {
      flexDirection: "row", alignItems: "center", gap: 11, minHeight: 56, paddingVertical: 9,
      borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border,
    },
    nome: { color: c.text, fontSize: font.size.md, fontWeight: "600" },
    // avatar NEUTRO de propósito: 5 círculos teal eram 5 chamarizes.
    avatarSm: {
      height: 36, width: 36, borderRadius: 18, alignItems: "center", justifyContent: "center",
      backgroundColor: c.surfaceAlt,
    },
    avatarSmTxt: { color: c.textMuted, fontWeight: "800", fontSize: 12.5 },
    avatarDoc: { height: 36, width: 36, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: c.surfaceAlt },
    papelBadge: { borderWidth: 1, borderColor: c.border, borderRadius: radius.full, paddingHorizontal: 7, paddingVertical: 2.5 },
    papelTxt: { color: c.textMuted, fontSize: 10, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.6 },

    // timeline de encontros
    evento: {
      flexDirection: "row", gap: 12, paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border,
    },
    eventoData: { width: 42, alignItems: "center" },
    eventoDia: { color: c.text, fontSize: 17, fontWeight: "800" },
    eventoMes: { color: c.textMuted, fontSize: 10, textTransform: "uppercase", letterSpacing: 0.8 },
    eventoPres: { color: c.text, fontSize: 14.5, fontWeight: "700" },
    eventoPresN: { color: c.success },
    eventoTema: { color: c.text, fontSize: 13.5, opacity: 0.82 },
    eventoObs: { color: c.textMuted, fontSize: 13, fontStyle: "italic", borderLeftWidth: 2, borderLeftColor: c.border, paddingLeft: 9 },

    // pedido
    pedido: { paddingVertical: 13, gap: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border },
    pedidoTopo: { flexDirection: "row", alignItems: "center", gap: 11 },

    // estado vazio · sem caixa cinza (o vazio não precisa de moldura) e com ação
    vazio: { alignItems: "center", gap: 7, paddingTop: 30, paddingBottom: 14, paddingHorizontal: spacing.md },
    vazioTit: { color: c.text, fontSize: 15.5, fontWeight: "700", textAlign: "center" },
    vazioTxt: { color: c.textMuted, fontSize: 13.5, textAlign: "center", maxWidth: 280, lineHeight: 19 },

    // linha discreta (convidar · pedir ajuda) — ação rara, peso de ação rara
    discreta: {
      flexDirection: "row", alignItems: "center", gap: 9, paddingVertical: 13, marginTop: 2,
      borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border,
    },
    discretaTxt: { color: c.textMuted, fontSize: 13.5 },

    // ── usados pelos MODAIS (chamada · saída · transferir · ajuda · recusa) ──
    card: { backgroundColor: c.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: c.glassBorder, padding: spacing.md, gap: spacing.sm },
    cardHead: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    avatar: { height: 44, width: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: c.primary + "22" },
    avatarTxt: { color: c.primary, fontWeight: "800", fontSize: font.size.md },
    membroCard: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    nomeRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, flexWrap: "wrap" },
    linhaTxt: { color: c.textMuted, fontSize: font.size.sm },
    acoes: { flexDirection: "row", gap: spacing.sm },
    btn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, minHeight: 44, borderRadius: radius.full },
    btnTxt: { fontWeight: "700", fontSize: font.size.sm },
    btnRecusar: { borderWidth: 1, borderColor: c.danger },
    btnAceitar: { backgroundColor: c.primary },
    btnRecusarSolido: { backgroundColor: c.danger },
    acaoItem: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: 14 },
    acaoTxt: { color: c.text, fontSize: font.size.md, fontWeight: "600" },
    acaoTxtPerigo: { color: c.danger },
    chamadaLinha: {
      flexDirection: "row", alignItems: "center", gap: spacing.sm,
      paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border,
    },
    chamadaNome: { color: c.text, fontSize: font.size.md, flex: 1 },
    modalWrap: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.45)" },
    sheet: { backgroundColor: c.background, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: spacing.md },
    sheetHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.sm },
    sheetTitle: { color: c.text, fontSize: font.size.lg, fontWeight: "800" },
    sheetLabel: { color: c.textMuted, fontSize: font.size.sm - 1, marginBottom: 4 },
    input: { backgroundColor: c.surfaceAlt, borderRadius: radius.sm, paddingHorizontal: 12, paddingVertical: 10, color: c.text, borderWidth: 1, borderColor: c.border, minHeight: 70, textAlignVertical: "top" },
  });
}
