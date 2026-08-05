// ============================================================================
// GERENCIAR GRUPO · tudo o que o líder faz, num lugar só (Marcos · 05/08/2026)
//
// Pedido dele: "gerenciar grupo, aqui temos que acertar muito nessa tela,
// precisamos trazer TODO gerenciamento de um grupo pra cá — aba de membros
// (podendo gerenciar quem é líder, ou em treinamento), registro de frequências
// (com comentários do líder e uma opção de pedir ajuda), aprovação de novos
// pedidos, saídas e transferências, estudos e opção de editar o grupo".
//
// 5 abas: Membros · Frequência · Pedidos · Estudos · Editar.
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
  ActivityIndicator, Alert, KeyboardAvoidingView, Linking, Modal, Platform,
  Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { useColors } from "@/contexts/ThemeContext";
import { useT } from "@/lib/i18n";
import { subirUmNivel } from "@/lib/hierarquia";
import { font, radius, spacing, type Palette } from "@/constants/theme";
import {
  getGrupoRoster, aprovarPedidoGrupo, recusarPedidoGrupo,
  mudarFuncaoMembroGrupo, registrarSaidaGrupo, transferirMembroGrupo,
  getEncontrosGrupo, registrarEncontroGrupo, pedirAjudaGrupo, getMateriaisGrupo,
  listarMeusGruposLider,
  type GrupoMembro, type GrupoPedido, type GrupoRoster,
  type GrupoEncontro, type GrupoMaterial, type FuncaoApp,
} from "@/lib/api";

type Aba = "membros" | "frequencia" | "pedidos" | "estudos";
const ABAS: { k: Aba; label: string; icone: React.ComponentProps<typeof Ionicons>["name"] }[] = [
  { k: "membros", label: "Membros", icone: "people-outline" },
  { k: "frequencia", label: "Frequência", icone: "checkbox-outline" },
  { k: "pedidos", label: "Pedidos", icone: "person-add-outline" },
  { k: "estudos", label: "Estudos", icone: "book-outline" },
];

const DIAS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const FUNCAO: Record<string, string> = {
  lider: "Líder", co_lider: "Co-líder", colider: "Co-líder",
  lider_treinamento: "Em treinamento", supervisor: "Supervisor",
  coordenador: "Coordenador", membro: "Membro", frequentador: "Frequentador",
  visitante: "Visitante",
};
const DESTAQUE = new Set(["lider", "co_lider", "colider", "coordenador", "supervisor"]);

function quando(dia: number | null | undefined, horario: string | null | undefined): string {
  const p: string[] = [];
  if (dia != null && dia >= 0 && dia <= 6) p.push(DIAS[dia]);
  if (horario) p.push(String(horario).slice(0, 5));
  return p.join(" · ");
}
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
  useEffect(() => {
    if (aba === "frequencia" && encontros === null) {
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
  const sub = grupo ? [quando(grupo.dia_semana, grupo.horario), grupo.local || grupo.bairro].filter(Boolean).join("  ·  ") : "";

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.header}>
        <Pressable onPress={() => subirUmNivel()} hitSlop={12} accessibilityRole="button" accessibilityLabel={t("Voltar")}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </Pressable>
        <Text style={styles.title} numberOfLines={1}>{nome}</Text>
        {/* ⚠️ EDITAR fica no cabeçalho, não como aba: é a única ação que abre
            OUTRA tela (/grupo-editar, que já existia e trata endereço, dia,
            categoria e foto). Virar aba daria a impressão de que o formulário
            está aqui dentro. */}
        <Pressable
          onPress={() => router.navigate({ pathname: "/grupo-editar", params: { id: grupoId } } as never)}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={t("Editar grupo")}
        >
          <Ionicons name="create-outline" size={24} color={colors.primary} />
        </Pressable>
      </View>

      {/* Abas do gerenciamento */}
      <View style={styles.abasRow}>
        {ABAS.map((op) => {
          const sel = aba === op.k;
          const badge = op.k === "pedidos" ? pendentes.length : 0;
          return (
            <Pressable
              key={op.k}
              onPress={() => setAba(op.k)}
              style={[styles.abaBtn, sel && styles.abaBtnAtiva]}
              accessibilityRole="button"
              accessibilityState={{ selected: sel }}
            >
              <Ionicons name={op.icone} size={16} color={sel ? "#fff" : colors.textMuted} />
              <Text style={[styles.abaTxt, sel && styles.abaTxtAtiva]}>{t(op.label)}</Text>
              {badge > 0 && (
                <View style={styles.abaBadge}><Text style={styles.abaBadgeTxt}>{badge}</Text></View>
              )}
            </Pressable>
          );
        })}
      </View>

      {data === null ? (
        <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40, gap: spacing.md }}
          refreshControl={<RefreshControl refreshing={refrescando} onRefresh={refrescar} tintColor={colors.primary} />}
        >
          {erro && !grupo ? (
            <View style={[styles.center, { paddingTop: spacing.xl }]}>
              <Ionicons name="lock-closed-outline" size={32} color={colors.textMuted} />
              <Text style={styles.muted}>{erro}</Text>
            </View>
          ) : (
            <>
              {/* resumo */}
              <View style={styles.card}>
                {!!sub && <Text style={styles.muted}>{sub}</Text>}
                <View style={styles.resumoRow}>
                  <View>
                    <Text style={styles.resumoNum}>{membros.length}</Text>
                    <Text style={styles.pequeno}>{membros.length === 1 ? t("membro") : t("membros")}</Text>
                  </View>
                  <View>
                    <Text style={[styles.resumoNum, pendentes.length ? { color: colors.primary } : null]}>{pendentes.length}</Text>
                    <Text style={styles.pequeno}>{pendentes.length === 1 ? t("pendente") : t("pendentes")}</Text>
                  </View>
                </View>
                {!!grupo?.descricao && <Text style={[styles.linhaTxt, { marginTop: spacing.sm }]}>{grupo.descricao}</Text>}
              </View>

              {/* ═══════════ PEDIDOS ═══════════ */}
              {aba === "pedidos" && (
                pendentes.length === 0 ? (
                  <View style={styles.card}>
                    <Text style={styles.muted}>{t("Nenhuma inscrição aguardando aprovação.")}</Text>
                  </View>
                ) : (
                  pendentes.map((p) => {
                    const wa = waLink(p.telefone);
                    const proc = processandoId === p.id;
                    return (
                      <View key={p.id} style={styles.card}>
                        <View style={styles.cardHead}>
                          <View style={styles.avatar}><Text style={styles.avatarTxt}>{iniciais(p.nome)}</Text></View>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.nome} numberOfLines={1}>{p.nome}</Text>
                            {wa ? (
                              <Pressable onPress={() => Linking.openURL(wa)} accessibilityRole="button">
                                <Text style={[styles.pequeno, { color: colors.primary }]} numberOfLines={1}>{p.telefone}</Text>
                              </Pressable>
                            ) : p.email ? <Text style={styles.pequeno} numberOfLines={1}>{p.email}</Text> : null}
                          </View>
                        </View>
                        {/* ⚠️ O fluxo certo é LIGAR antes de decidir (pedido do
                            Pr. Nélio, no template do WhatsApp) — e recusar aqui
                            DEVOLVE pra triagem, não avisa a pessoa. */}
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
                  })
                )
              )}

              {/* ═══════════ MEMBROS ═══════════ */}
              {aba === "membros" && (
                membros.length === 0 ? (
                  <View style={styles.card}><Text style={styles.muted}>{t("Ninguém no grupo ainda. Ao aceitar uma inscrição, a pessoa entra aqui.")}</Text></View>
                ) : (
                  membros.map((m: GrupoMembro) => {
                    const wa = waLink(m.telefone);
                    const fLabel = m.funcao ? (FUNCAO[m.funcao] || null) : null;
                    const destaque = !!m.funcao && DESTAQUE.has(m.funcao);
                    const ehPrincipal = !!m.membro_id && !!liderPrincipalId && m.membro_id === liderPrincipalId;
                    return (
                      <View key={m.id} style={[styles.card, styles.membroCard]}>
                        <View style={styles.avatarSm}><Text style={styles.avatarSmTxt}>{iniciais(m.nome)}</Text></View>
                        <View style={{ flex: 1 }}>
                          <View style={styles.nomeRow}>
                            <Text style={styles.nome} numberOfLines={1}>{m.nome}</Text>
                            {ehPrincipal ? (
                              <View style={styles.papelBadge}><Text style={styles.papelTxt}>{t("Líder principal")}</Text></View>
                            ) : fLabel && destaque ? (
                              <View style={styles.papelBadge}><Text style={styles.papelTxt}>{t(fLabel)}</Text></View>
                            ) : null}
                          </View>
                          <Text style={styles.pequeno}>
                            {[fLabel && !destaque ? t(fLabel) : null,
                              m.presencas != null ? `${m.presencas} ${m.presencas === 1 ? t("presença") : t("presenças")}` : null,
                            ].filter(Boolean).join(" · ")}
                          </Text>
                        </View>
                        {wa ? (
                          <Pressable onPress={() => Linking.openURL(wa)} hitSlop={8} accessibilityRole="button" accessibilityLabel={`${t("WhatsApp")} ${m.nome}`}>
                            <Ionicons name="logo-whatsapp" size={22} color="#25D366" />
                          </Pressable>
                        ) : null}
                        {/* ⚠️ Só a LÍDER PRINCIPAL não tem menu de ações: mudar a
                            função ou registrar a saída dela mexeria em quem
                            recebe o WhatsApp do grupo, e isso é da coordenação.
                            Os outros líderes (cadastro) têm as ações normais. */}
                        {!ehPrincipal && (
                          <Pressable onPress={() => setAcaoAlvo(m)} hitSlop={8} accessibilityRole="button" accessibilityLabel={`${t("Opções de")} ${m.nome}`}>
                            {processandoId === m.id
                              ? <ActivityIndicator size="small" color={colors.primary} />
                              : <Ionicons name="ellipsis-vertical" size={20} color={colors.textMuted} />}
                          </Pressable>
                        )}
                      </View>
                    );
                  })
                )
              )}

              {/* ═══════════ FREQUÊNCIA ═══════════ */}
              {aba === "frequencia" && (
                <>
                  <Pressable style={[styles.btn, styles.btnAceitar, { alignSelf: "stretch" }]} onPress={abrirChamada} accessibilityRole="button">
                    <Ionicons name="checkbox-outline" size={18} color="#fff" />
                    <Text style={[styles.btnTxt, { color: "#fff" }]}>{t("Registrar frequência de hoje")}</Text>
                  </Pressable>

                  <Pressable style={styles.ajudaCard} onPress={() => { setAjudaMsg(""); setAjudaAberta(true); }} accessibilityRole="button">
                    <Ionicons name="help-buoy-outline" size={20} color={colors.primary} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.nome}>{t("Preciso de ajuda")}</Text>
                      <Text style={styles.pequeno}>{t("A coordenação de Grupos recebe seu pedido")}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                  </Pressable>

                  <Text style={styles.secLabel}>{t("Encontros registrados")}</Text>
                  {encontros === null ? (
                    <ActivityIndicator color={colors.primary} />
                  ) : encontros.length === 0 ? (
                    <View style={styles.card}><Text style={styles.muted}>{t("Nenhum encontro registrado ainda.")}</Text></View>
                  ) : (
                    encontros.map((e) => (
                      <View key={e.id} style={styles.card}>
                        <View style={styles.nomeRow}>
                          <Text style={styles.nome}>{String(e.data).split("-").reverse().join("/")}</Text>
                          <View style={styles.papelBadge}>
                            <Text style={styles.papelTxt}>{e.presentes} {e.presentes === 1 ? t("presente") : t("presentes")}</Text>
                          </View>
                        </View>
                        {!!e.tema && <Text style={styles.linhaTxt}>{e.tema}</Text>}
                        {!!e.observacoes && <Text style={[styles.pequeno, { marginTop: 4 }]}>“{e.observacoes}”</Text>}
                        {!!e.registrado_por_nome && <Text style={styles.pequeno}>{t("por")} {e.registrado_por_nome}</Text>}
                      </View>
                    ))
                  )}
                </>
              )}

              {/* ═══════════ ESTUDOS ═══════════ */}
              {aba === "estudos" && (
                materiais === null ? (
                  <ActivityIndicator color={colors.primary} />
                ) : materiais.length === 0 ? (
                  <View style={styles.card}>
                    <Text style={styles.muted}>{t("Nenhum estudo publicado pra este grupo ainda. A coordenação publica os materiais no sistema.")}</Text>
                  </View>
                ) : (
                  materiais.map((mt) => (
                    <Pressable
                      key={mt.id}
                      style={[styles.card, styles.membroCard]}
                      disabled={!mt.url}
                      onPress={() => mt.url && Linking.openURL(mt.url)}
                      accessibilityRole="button"
                    >
                      <Ionicons name={mt.estudo_semana ? "bookmark" : "document-text-outline"} size={22} color={mt.estudo_semana ? colors.primary : colors.textMuted} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.nome} numberOfLines={2}>{mt.nome}</Text>
                        <Text style={styles.pequeno}>
                          {[mt.estudo_semana ? t("Estudo da semana") : null, (mt.etiquetas || []).join(", ") || null]
                            .filter(Boolean).join(" · ")}
                        </Text>
                      </View>
                      {mt.url ? <Ionicons name="open-outline" size={18} color={colors.textMuted} /> : null}
                    </Pressable>
                  ))
                )
              )}

            </>
          )}
        </ScrollView>
      )}

      {/* Modal de recusa */}
      <Modal visible={!!recusaAlvo} animationType="slide" transparent statusBarTranslucent onRequestClose={() => setRecusaAlvo(null)}>
        <KeyboardAvoidingView style={styles.modalWrap} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <View style={[styles.sheet, { paddingBottom: spacing.md + insets.bottom }]}>
            <View style={styles.sheetHead}>
              <Text style={styles.sheetTitle}>{t("Recusar inscrição")}</Text>
              <Pressable onPress={() => setRecusaAlvo(null)} hitSlop={12} accessibilityRole="button" accessibilityLabel={t("Fechar")}>
                <Ionicons name="close" size={24} color={colors.text} />
              </Pressable>
            </View>
            {recusaAlvo && <Text style={[styles.muted, { marginBottom: spacing.xs }]}>{t("Recusar a inscrição de")} {recusaAlvo.nome}?</Text>}
            <Text style={[styles.muted, { marginBottom: spacing.sm }]}>
              {t("O pedido volta pra equipe de grupos, que cuida do próximo passo com a pessoa. Ela não recebe aviso automático.")}
            </Text>
            <Text style={styles.sheetLabel}>{t("Motivo (opcional)")}</Text>
            <TextInput
              style={styles.input}
              placeholder={t("Ex.: grupo lotado, pessoa já em outro grupo…")}
              placeholderTextColor={colors.textMuted}
              value={motivo}
              onChangeText={setMotivo}
              multiline
            />
            <Pressable style={[styles.btn, styles.btnRecusarSolido, { marginTop: spacing.md }]} disabled={!!processandoId} onPress={confirmarRecusa} accessibilityRole="button">
              {processandoId ? <ActivityIndicator color="#fff" size="small" /> : <Text style={[styles.btnTxt, { color: "#fff" }]}>{t("Confirmar recusa")}</Text>}
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>

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
        <KeyboardAvoidingView style={styles.modalWrap} behavior={Platform.OS === "ios" ? "padding" : undefined}>
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
        </KeyboardAvoidingView>
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
        <KeyboardAvoidingView style={styles.modalWrap} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <View style={[styles.sheet, { paddingBottom: spacing.md + insets.bottom, maxHeight: "88%" }]}>
            <View style={styles.sheetHead}>
              <Text style={styles.sheetTitle}>{t("Frequência de hoje")}</Text>
              <Pressable onPress={() => setChamadaAberta(false)} hitSlop={12} accessibilityRole="button" accessibilityLabel={t("Fechar")}>
                <Ionicons name="close" size={24} color={colors.text} />
              </Pressable>
            </View>
            <ScrollView style={{ maxHeight: 320 }}>
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
        </KeyboardAvoidingView>
      </Modal>

      {/* ═══ Pedir ajuda ═══ */}
      <Modal visible={ajudaAberta} animationType="slide" transparent statusBarTranslucent onRequestClose={() => setAjudaAberta(false)}>
        <KeyboardAvoidingView style={styles.modalWrap} behavior={Platform.OS === "ios" ? "padding" : undefined}>
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
        </KeyboardAvoidingView>
      </Modal>

    </SafeAreaView>
  );
}

function makeStyles(c: Palette) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.background },
    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: spacing.sm },
    title: { flex: 1, color: c.text, fontSize: font.size.lg, fontWeight: "800", textAlign: "center" },
    center: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.lg, gap: spacing.md },
    muted: { color: c.textMuted, fontSize: font.size.md, textAlign: "center" },
    pequeno: { color: c.textMuted, fontSize: font.size.sm },
    secLabel: { color: c.textMuted, fontSize: font.size.sm - 1, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5, marginTop: spacing.xs },
    // Abas do gerenciamento (Membros · Frequência · Pedidos · Estudos)
    abasRow: { flexDirection: "row", gap: 6, paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
    abaBtn: {
      flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4,
      paddingVertical: 8, paddingHorizontal: 4, borderRadius: radius.full,
      borderWidth: 1, borderColor: c.border, backgroundColor: c.surfaceAlt,
    },
    abaBtnAtiva: { backgroundColor: c.primary, borderColor: c.primary },
    abaTxt: { color: c.textMuted, fontSize: 11, fontWeight: "700" },
    abaTxtAtiva: { color: "#fff" },
    abaBadge: {
      minWidth: 16, height: 16, paddingHorizontal: 4, borderRadius: radius.full,
      backgroundColor: c.danger, alignItems: "center", justifyContent: "center",
    },
    abaBadgeTxt: { color: "#fff", fontSize: 9, fontWeight: "800" },
    ajudaCard: {
      flexDirection: "row", alignItems: "center", gap: spacing.sm,
      backgroundColor: c.surface, borderRadius: radius.lg, borderWidth: 1,
      borderColor: c.glassBorder, padding: spacing.md,
    },
    // Folha de ações do participante
    acaoItem: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: 14 },
    acaoTxt: { color: c.text, fontSize: font.size.md, fontWeight: "600" },
    acaoTxtPerigo: { color: c.danger },
    chamadaLinha: {
      flexDirection: "row", alignItems: "center", gap: spacing.sm,
      paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border,
    },
    chamadaNome: { color: c.text, fontSize: font.size.md, flex: 1 },
    card: { backgroundColor: c.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: c.glassBorder, padding: spacing.md, gap: spacing.sm },
    resumoRow: { flexDirection: "row", gap: spacing.xl, marginTop: spacing.xs },
    resumoNum: { color: c.text, fontSize: font.size.xl, fontWeight: "800" },
    cardHead: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    avatar: { height: 44, width: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: c.primary + "22" },
    avatarTxt: { color: c.primary, fontWeight: "800", fontSize: font.size.md },
    membroCard: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    avatarSm: { height: 38, width: 38, borderRadius: 19, alignItems: "center", justifyContent: "center", backgroundColor: c.primary + "1A" },
    avatarSmTxt: { color: c.primary, fontWeight: "800", fontSize: font.size.sm },
    nomeRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, flexWrap: "wrap" },
    nome: { color: c.text, fontSize: font.size.md, fontWeight: "800" },
    papelBadge: { backgroundColor: c.glass, borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 2 },
    papelTxt: { color: c.primary, fontSize: 11, fontWeight: "700" },
    linhaTxt: { color: c.textMuted, fontSize: font.size.sm },
    acoes: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.xs },
    btn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 12, borderRadius: radius.full },
    btnTxt: { fontWeight: "700", fontSize: font.size.sm },
    btnRecusar: { borderWidth: 1, borderColor: c.danger },
    btnAceitar: { backgroundColor: c.primary },
    btnRecusarSolido: { backgroundColor: c.danger },
    modalWrap: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.45)" },
    sheet: { backgroundColor: c.background, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: spacing.md },
    sheetHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.sm },
    sheetTitle: { color: c.text, fontSize: font.size.lg, fontWeight: "800" },
    sheetLabel: { color: c.textMuted, fontSize: font.size.sm - 1, marginBottom: 4 },
    input: { backgroundColor: c.surfaceAlt, borderRadius: radius.sm, paddingHorizontal: 12, paddingVertical: 10, color: c.text, borderWidth: 1, borderColor: c.border, minHeight: 70, textAlignVertical: "top" },
  });
}
