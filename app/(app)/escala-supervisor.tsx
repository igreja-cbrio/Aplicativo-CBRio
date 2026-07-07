import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator, Alert, KeyboardAvoidingView, Modal, Platform, Pressable,
  RefreshControl, ScrollView, StyleSheet, Text, TextInput, View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { useAnimatedStyle, useSharedValue, runOnJS } from "react-native-reanimated";
import { useColors } from "@/contexts/ThemeContext";
import { font, radius, spacing, type Palette } from "@/constants/theme";
import {
  getEscalaServicos, getEscala, buscarEscalaPool, adicionarNaEscala, removerDaEscala, moverNaEscala,
  type EscalaServico, type EscalaItem, type PoolVoluntario,
} from "@/lib/api";

const DIA_MS = 86400000;
function fmtData(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  // scheduled_at vem em UTC · converte pra horário de Brasília (UTC-3, sem DST).
  const brt = new Date(d.getTime() - 3 * 3600 * 1000);
  const dias = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
  const dd = String(brt.getUTCDate()).padStart(2, "0");
  const mm = String(brt.getUTCMonth() + 1).padStart(2, "0");
  const hh = String(brt.getUTCHours()).padStart(2, "0");
  const mi = String(brt.getUTCMinutes()).padStart(2, "0");
  // Rótulo relativo (Hoje/Amanhã) pra escolher o culto certo rápido.
  const hojeBrt = new Date(Date.now() - 3 * 3600 * 1000);
  const diaAlvo = Date.UTC(brt.getUTCFullYear(), brt.getUTCMonth(), brt.getUTCDate());
  const diaHoje = Date.UTC(hojeBrt.getUTCFullYear(), hojeBrt.getUTCMonth(), hojeBrt.getUTCDate());
  const delta = Math.round((diaAlvo - diaHoje) / DIA_MS);
  const rel = delta === 0 ? "Hoje" : delta === 1 ? "Amanhã" : `${dias[brt.getUTCDay()]} ${dd}/${mm}`;
  return `${rel} ${hh}:${mi}`;
}
function iniciais(nome: string): string {
  const p = (nome || "").trim().split(/\s+/).filter(Boolean);
  if (!p.length) return "?";
  return ((p[0][0] || "") + (p.length > 1 ? p[p.length - 1][0] : "")).toUpperCase();
}

export default function EscalaSupervisorScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const router = useRouter();

  const [servicos, setServicos] = useState<EscalaServico[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const [servicoSel, setServicoSel] = useState<EscalaServico | null>(null);
  const [escala, setEscala] = useState<EscalaItem[]>([]);
  const [carregandoEscala, setCarregandoEscala] = useState(false);
  const [refrescando, setRefrescando] = useState(false);
  const [recolhidos, setRecolhidos] = useState<Set<string>>(new Set());

  // Modal de adicionar
  const [addOpen, setAddOpen] = useState(false);
  const [addTeam, setAddTeam] = useState<string>("");
  const [novaEquipe, setNovaEquipe] = useState("");
  const [posicao, setPosicao] = useState("");
  const [busca, setBusca] = useState("");
  const [resultados, setResultados] = useState<PoolVoluntario[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [buscaErro, setBuscaErro] = useState(false);
  const [salvandoId, setSalvandoId] = useState<string | null>(null);
  const [removendoId, setRemovendoId] = useState<string | null>(null);
  const buscaTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const buscaSeq = useRef(0);

  // ── Drag & drop: apertar e arrastar o nome pra outra equipe ──
  const scrollWrapRef = useRef<View>(null);
  const scrollTopRef = useRef(0);
  const scrollYRef = useRef(0);
  const teamLayoutRef = useRef<Record<string, { y: number; h: number }>>({});
  const dragItemRef = useRef<EscalaItem | null>(null);
  const hoverRef = useRef<string | null>(null);
  const [dragItem, setDragItem] = useState<EscalaItem | null>(null);
  const [hoverTeam, setHoverTeam] = useState<string | null>(null);
  const ghostX = useSharedValue(0);
  const ghostY = useSharedValue(0);
  const ghostStyle = useAnimatedStyle(() => ({ transform: [{ translateX: ghostX.value - 120 }, { translateY: ghostY.value - 22 }] }));

  function teamNoPonto(absY: number): string | null {
    const contentY = absY - scrollTopRef.current + scrollYRef.current;
    for (const [team, z] of Object.entries(teamLayoutRef.current)) {
      if (contentY >= z.y && contentY <= z.y + z.h) return team;
    }
    return null;
  }
  function iniciarDrag(item: EscalaItem, ax: number, ay: number) {
    dragItemRef.current = item; setDragItem(item);
    ghostX.value = ax; ghostY.value = ay;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    scrollWrapRef.current?.measureInWindow?.((_x: number, y: number) => { scrollTopRef.current = y; });
  }
  function atualizarHover(absY: number) {
    const t = teamNoPonto(absY);
    if (t !== hoverRef.current) { hoverRef.current = t; setHoverTeam(t); }
  }
  async function soltarDrag() {
    const item = dragItemRef.current; const alvo = hoverRef.current;
    dragItemRef.current = null; hoverRef.current = null;
    setDragItem(null); setHoverTeam(null);
    if (!item || !alvo) return;
    const atualTeam = item.team_name || "Sem equipe";
    if (alvo === atualTeam) return;
    setEscala(prev => prev.map(e => e.id === item.id ? { ...e, team_name: alvo === "Sem equipe" ? null : alvo } : e));
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    try { await moverNaEscala(item.id, alvo === "Sem equipe" ? null : alvo); }
    catch (e: any) { Alert.alert("Erro", e?.message || "Erro ao mover"); if (servicoSel) carregarEscala(servicoSel.id); }
  }

  const carregarServicos = useCallback(async (autoSel = false) => {
    try {
      const r = await getEscalaServicos();
      const lista = r.servicos || [];
      setServicos(lista);
      setErro(null);
      if (autoSel && lista.length && !servicoSel) selecionar(lista[0]); // culto mais próximo
    } catch (e: any) {
      setErro(e?.message || "Erro ao carregar cultos");
    } finally { setCarregando(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { carregarServicos(true); }, [carregarServicos]);

  const carregarEscala = useCallback(async (serviceId: string) => {
    setCarregandoEscala(true);
    try { setEscala(await getEscala(serviceId)); }
    catch (e: any) { Alert.alert("Erro", e?.message || "Erro ao carregar a escala"); }
    finally { setCarregandoEscala(false); }
  }, []);

  function selecionar(s: EscalaServico) {
    setServicoSel(s);
    setRecolhidos(new Set());
    carregarEscala(s.id);
  }

  async function refrescar() {
    if (!servicoSel) return;
    setRefrescando(true);
    try { setEscala(await getEscala(servicoSel.id)); await carregarServicos(); }
    catch { /* silencioso no pull */ }
    finally { setRefrescando(false); }
  }

  const grupos = useMemo(() => {
    const m = new Map<string, EscalaItem[]>();
    for (const e of escala) {
      const k = e.team_name || "Sem equipe";
      const arr = m.get(k) || [];
      arr.push(e); m.set(k, arr);
    }
    const arr = [...m.entries()];
    for (const [, lista] of arr) lista.sort((a, b) => a.volunteer_name.localeCompare(b.volunteer_name, "pt-BR"));
    arr.sort((a, b) => a[0].localeCompare(b[0], "pt-BR"));
    return arr;
  }, [escala]);

  const equipes = useMemo(() => grupos.map(([t]) => t).filter(t => t !== "Sem equipe"), [grupos]);
  const resumo = useMemo(() => ({
    total: escala.length,
    conf: escala.filter(e => e.confirmation_status === "confirmed").length,
    rec: escala.filter(e => e.confirmation_status === "declined").length,
  }), [escala]);

  // Já escalados NA EQUIPE destino (permite a mesma pessoa em outra equipe).
  const teamAtual = novaEquipe.trim() || addTeam;
  const jaNaEquipe = useMemo(() => {
    const set = new Set<string>();
    for (const e of escala) if ((e.team_name || "Sem equipe") === teamAtual && e.volunteer_id) set.add(e.volunteer_id);
    return set;
  }, [escala, teamAtual]);

  function toggle(team: string) {
    setRecolhidos(prev => { const n = new Set(prev); n.has(team) ? n.delete(team) : n.add(team); return n; });
  }

  // Busca com debounce (300ms) + guarda de sequência (ignora resposta obsoleta).
  function onBusca(q: string) {
    setBusca(q);
    setBuscaErro(false);
    if (buscaTimer.current) clearTimeout(buscaTimer.current);
    if (q.trim().length < 2) { setResultados([]); setBuscando(false); return; }
    setBuscando(true);
    const seq = ++buscaSeq.current;
    buscaTimer.current = setTimeout(async () => {
      try {
        const r = await buscarEscalaPool(q.trim());
        if (seq === buscaSeq.current) { setResultados(r); setBuscaErro(false); }
      } catch {
        if (seq === buscaSeq.current) { setResultados([]); setBuscaErro(true); }
      } finally {
        if (seq === buscaSeq.current) setBuscando(false);
      }
    }, 300);
  }

  function abrirAdd(team?: string) {
    setAddTeam(team || "Sem equipe");
    setNovaEquipe(""); setPosicao(""); setBusca(""); setResultados([]); setBuscaErro(false);
    setAddOpen(true);
  }

  async function adicionar(vol: PoolVoluntario) {
    if (!servicoSel) return;
    const team = teamAtual;
    setSalvandoId(vol.id);
    try {
      const novo = await adicionarNaEscala({
        service_id: servicoSel.id, volunteer_id: vol.id,
        team_name: team === "Sem equipe" ? undefined : team,
        position_name: posicao.trim() || undefined,
      });
      // Otimista: usa a resposta, sem refetch bloqueante.
      setEscala(prev => [...prev, novo]);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setBusca(""); setResultados([]);
    } catch (e: any) {
      Alert.alert("Erro", e?.message || "Erro ao escalar");
    } finally { setSalvandoId(null); }
  }

  function remover(item: EscalaItem) {
    Alert.alert("Remover da escala", `Tirar ${item.volunteer_name} da escala?`, [
      { text: "Cancelar", style: "cancel" },
      { text: "Remover", style: "destructive", onPress: async () => {
        setRemovendoId(item.id);
        try { await removerDaEscala(item.id); setEscala(prev => prev.filter(e => e.id !== item.id)); }
        catch (e: any) { Alert.alert("Erro", e?.message || "Erro ao remover"); }
        finally { setRemovendoId(null); }
      } },
    ]);
  }

  const statusInfo = (s: string | null) =>
    s === "confirmed" ? { cor: (colors as any).success || "#22c55e", label: "confirmado" }
    : s === "declined" ? { cor: (colors as any).danger || "#ef4444", label: "recusou" }
    : { cor: colors.textMuted, label: "pendente" };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button" accessibilityLabel="Voltar">
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </Pressable>
        <Text style={styles.title}>Montar escala</Text>
        <View style={{ width: 26 }} />
      </View>

      {carregando ? (
        <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>
      ) : erro ? (
        <View style={styles.center}>
          <Text style={[styles.muted, { marginBottom: 12 }]}>{erro}</Text>
          <Pressable style={styles.retry} onPress={() => { setCarregando(true); carregarServicos(true); }} accessibilityRole="button">
            <Ionicons name="refresh" size={16} color={colors.primary} />
            <Text style={[styles.pequeno, { color: colors.primary }]}>Tentar de novo</Text>
          </Pressable>
        </View>
      ) : (
        <>
          {/* Seletor de culto · chips horizontais (compacto) */}
          <View style={styles.cultoBar}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: spacing.md, gap: 8 }}>
              {servicos.length === 0 && <Text style={styles.muted}>Nenhum culto próximo.</Text>}
              {servicos.map(s => {
                const ativo = servicoSel?.id === s.id;
                return (
                  <Pressable key={s.id} onPress={() => selecionar(s)} accessibilityRole="button"
                    accessibilityLabel={`${s.service_type_name || "Culto"}, ${fmtData(s.scheduled_at)}, ${s.escalados || 0} escalados`}
                    style={[styles.cultoChip, ativo && { borderColor: colors.primary, backgroundColor: colors.primary }]}>
                    <Text style={[styles.cultoChipNome, ativo && { color: "#fff" }]} numberOfLines={1}>{s.service_type_name || "Culto"}</Text>
                    <Text style={[styles.cultoChipData, ativo && { color: "#fff" }]}>{fmtData(s.scheduled_at)} · {s.escalados || 0} esc.</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          {!servicoSel ? (
            <View style={styles.center}><Text style={styles.muted}>Escolha um culto acima pra montar a escala.</Text></View>
          ) : carregandoEscala && !refrescando ? (
            <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>
          ) : (
            <View ref={scrollWrapRef} style={{ flex: 1 }}>
            <ScrollView
              contentContainerStyle={{ padding: spacing.md, paddingBottom: 100, gap: 8 }}
              onScroll={e => { scrollYRef.current = e.nativeEvent.contentOffset.y; }}
              scrollEventThrottle={16}
              scrollEnabled={!dragItem}
              refreshControl={<RefreshControl refreshing={refrescando} onRefresh={refrescar} tintColor={colors.primary} />}
            >
              {/* Resumo de confirmações */}
              {escala.length > 0 && (
                <View style={styles.resumo}>
                  <Text style={styles.resumoTxt}>{resumo.total} escalados</Text>
                  <Text style={[styles.resumoTxt, { color: statusInfo("confirmed").cor }]}>{resumo.conf} confirmados</Text>
                  {resumo.rec > 0 && <Text style={[styles.resumoTxt, { color: statusInfo("declined").cor }]}>{resumo.rec} recusaram</Text>}
                </View>
              )}
              {escala.length > 0 && (
                <Text style={[styles.pequeno, { color: colors.textMuted, paddingHorizontal: 2 }]}>
                  Segure um nome e arraste pra mudar de equipe.
                </Text>
              )}

              {grupos.length === 0 ? (
                <Text style={styles.muted}>Ninguém escalado ainda. Toque em “Adicionar” pra começar.</Text>
              ) : grupos.map(([team, lista]) => {
                const aberto = !recolhidos.has(team);
                const conf = lista.filter(x => x.confirmation_status === "confirmed").length;
                const alvoDrop = !!dragItem && hoverTeam === team && (dragItem.team_name || "Sem equipe") !== team;
                return (
                  <View key={team}
                    onLayout={e => { teamLayoutRef.current[team] = { y: e.nativeEvent.layout.y, h: e.nativeEvent.layout.height }; }}
                    style={[styles.teamCard, alvoDrop && { borderColor: colors.primary, borderWidth: 2, backgroundColor: colors.primary + "12" }]}>
                    <Pressable style={styles.teamHead} onPress={() => toggle(team)} accessibilityRole="button" accessibilityLabel={`Equipe ${team}, ${aberto ? "recolher" : "expandir"}`}>
                      <Ionicons name={aberto ? "chevron-down" : "chevron-forward"} size={18} color={colors.textMuted} />
                      <Text style={styles.teamNome} numberOfLines={1}>{team}</Text>
                      <View style={styles.badge}><Text style={styles.badgeTxt}>{conf}/{lista.length}</Text></View>
                    </Pressable>
                    {aberto && (
                      <View>
                        {lista.map(item => {
                          const si = statusInfo(item.confirmation_status);
                          const pan = Gesture.Pan().activateAfterLongPress(250)
                            .onStart(e => { runOnJS(iniciarDrag)(item, e.absoluteX, e.absoluteY); })
                            .onUpdate(e => { ghostX.value = e.absoluteX; ghostY.value = e.absoluteY; runOnJS(atualizarHover)(e.absoluteY); })
                            .onFinalize(() => { runOnJS(soltarDrag)(); });
                          return (
                            <GestureDetector key={item.id} gesture={pan}>
                              <View style={[styles.pessoa, dragItem?.id === item.id && { opacity: 0.35 }]}>
                                <Ionicons name="reorder-three" size={18} color={colors.textMuted} />
                                <View style={[styles.avatar, { backgroundColor: si.cor + "22" }]}>
                                  <Text style={[styles.avatarTxt, { color: si.cor }]}>{iniciais(item.volunteer_name)}</Text>
                                </View>
                                <View style={{ flex: 1 }}>
                                  <Text style={styles.pessoaNome} numberOfLines={1}>{item.volunteer_name}</Text>
                                  <Text style={[styles.pequeno, { color: si.cor }]}>{si.label}{item.confirmation_status === "declined" && item.recusa_motivo ? ` · ${item.recusa_motivo}` : (item.position_name ? ` · ${item.position_name}` : "")}</Text>
                                </View>
                                {removendoId === item.id ? <ActivityIndicator color={colors.textMuted} />
                                  : <Pressable onPress={() => remover(item)} hitSlop={14} accessibilityRole="button" accessibilityLabel={`Remover ${item.volunteer_name} da escala`}>
                                      <Ionicons name="close-circle" size={22} color={colors.textMuted} />
                                    </Pressable>}
                              </View>
                            </GestureDetector>
                          );
                        })}
                        <Pressable onPress={() => abrirAdd(team)} style={styles.addInline} accessibilityRole="button">
                          <Ionicons name="add" size={16} color={colors.primary} />
                          <Text style={[styles.pequeno, { color: colors.primary }]}>Adicionar a {team}</Text>
                        </Pressable>
                      </View>
                    )}
                  </View>
                );
              })}
            </ScrollView>
            </View>
          )}

          {/* Fantasma que segue o dedo durante o arraste */}
          {dragItem && (
            <Animated.View pointerEvents="none" style={[styles.ghost, ghostStyle]}>
              <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
                <Text style={[styles.avatarTxt, { color: "#fff" }]}>{iniciais(dragItem.volunteer_name)}</Text>
              </View>
              <Text style={styles.ghostTxt} numberOfLines={1}>{dragItem.volunteer_name}</Text>
            </Animated.View>
          )}

          {servicoSel && !carregandoEscala && (
            <Pressable style={styles.fab} onPress={() => abrirAdd()} accessibilityRole="button" accessibilityLabel="Adicionar voluntário">
              <Ionicons name="person-add" size={20} color="#fff" />
              <Text style={styles.fabTxt}>Adicionar</Text>
            </Pressable>
          )}
        </>
      )}

      {/* Modal de adicionar */}
      <Modal visible={addOpen} animationType="slide" transparent statusBarTranslucent onRequestClose={() => setAddOpen(false)}>
        <KeyboardAvoidingView style={styles.modalWrap} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <View style={[styles.sheet, { paddingBottom: spacing.md + insets.bottom }]}>
            <View style={styles.sheetHead}>
              <Text style={styles.sheetTitle}>Adicionar voluntário</Text>
              <Pressable onPress={() => setAddOpen(false)} hitSlop={12} accessibilityRole="button" accessibilityLabel="Fechar"><Ionicons name="close" size={24} color={colors.text} /></Pressable>
            </View>

            <Text style={styles.sheetLabel}>Equipe</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
              {[...equipes, "Sem equipe"].map(t => {
                const ativo = !novaEquipe.trim() && addTeam === t;
                return (
                  <Pressable key={t} onPress={() => { setAddTeam(t); setNovaEquipe(""); }}
                    style={[styles.teamPick, ativo && { borderColor: colors.primary, backgroundColor: colors.primary + "18" }]}>
                    <Text style={[styles.pequeno, { color: ativo ? colors.primary : colors.text }]}>{t}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            <View style={{ flexDirection: "row", gap: 8, marginTop: 6 }}>
              <TextInput style={[styles.input, { flex: 1 }]} placeholder="…ou nova equipe" placeholderTextColor={colors.textMuted}
                value={novaEquipe} onChangeText={setNovaEquipe} />
              <TextInput style={[styles.input, { flex: 1 }]} placeholder="Função (opcional)" placeholderTextColor={colors.textMuted}
                value={posicao} onChangeText={setPosicao} />
            </View>

            <View style={styles.searchBox}>
              <Ionicons name="search" size={18} color={colors.textMuted} />
              <TextInput style={styles.searchInput} placeholder="Buscar voluntário pelo nome…" placeholderTextColor={colors.textMuted}
                value={busca} onChangeText={onBusca} autoFocus autoCorrect={false} />
              {buscando && <ActivityIndicator color={colors.primary} />}
            </View>

            <ScrollView style={{ maxHeight: 300 }} keyboardShouldPersistTaps="handled">
              {busca.trim().length < 2 ? (
                <Text style={[styles.muted, { padding: spacing.md, textAlign: "center" }]}>Digite ao menos 2 letras do nome.</Text>
              ) : buscaErro ? (
                <Pressable style={{ padding: spacing.md, alignItems: "center" }} onPress={() => onBusca(busca)}>
                  <Text style={[styles.muted, { textAlign: "center" }]}>Falha ao buscar. Toque pra tentar de novo.</Text>
                </Pressable>
              ) : (!buscando && resultados.length === 0) ? (
                <Text style={[styles.muted, { padding: spacing.md, textAlign: "center" }]}>Nenhum voluntário encontrado.</Text>
              ) : resultados.map(v => {
                const escalado = v.id ? jaNaEquipe.has(v.id) : false;
                return (
                  <Pressable key={v.id} style={styles.resultado} disabled={!!salvandoId || escalado} onPress={() => adicionar(v)} accessibilityRole="button" accessibilityLabel={`Adicionar ${v.full_name}`}>
                    <View style={[styles.avatar, { backgroundColor: colors.primary + "22" }]}>
                      <Text style={[styles.avatarTxt, { color: colors.primary }]}>{iniciais(v.full_name)}</Text>
                    </View>
                    <Text style={[styles.pessoaNome, { flex: 1 }]} numberOfLines={1}>{v.full_name}</Text>
                    {salvandoId === v.id ? <ActivityIndicator color={colors.primary} />
                      : escalado ? <Text style={[styles.pequeno, { color: colors.textMuted }]}>nesta equipe</Text>
                      : <Ionicons name="add-circle" size={24} color={colors.primary} />}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

function makeStyles(c: Palette) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.background },
    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
    title: { color: c.text, fontSize: font.size.lg, fontWeight: "700" },
    center: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.lg },
    muted: { color: c.textMuted, fontSize: font.size.sm },
    pequeno: { fontSize: font.size.sm },
    retry: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.full, borderWidth: 1, borderColor: c.primary },
    cultoBar: { paddingVertical: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border },
    cultoChip: { minWidth: 150, paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.md, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface },
    cultoChipNome: { color: c.text, fontSize: font.size.sm, fontWeight: "700" },
    cultoChipData: { color: c.textMuted, fontSize: font.size.sm - 1, marginTop: 2 },
    resumo: { flexDirection: "row", flexWrap: "wrap", gap: 12, paddingHorizontal: 4, paddingBottom: 2 },
    resumoTxt: { color: c.textMuted, fontSize: font.size.sm, fontWeight: "600" },
    teamCard: { backgroundColor: c.surface, borderRadius: radius.md, borderWidth: 1, borderColor: c.border, overflow: "hidden" },
    teamHead: { flexDirection: "row", alignItems: "center", gap: 8, padding: spacing.md },
    teamNome: { color: c.text, fontSize: font.size.md, fontWeight: "700", flex: 1 },
    badge: { backgroundColor: c.surfaceAlt, borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 2 },
    badgeTxt: { color: c.textMuted, fontSize: font.size.sm - 1, fontWeight: "600" },
    pessoa: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: spacing.md, paddingVertical: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border },
    avatar: { height: 34, width: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
    avatarTxt: { fontSize: font.size.sm - 1, fontWeight: "700" },
    pessoaNome: { color: c.text, fontSize: font.size.sm },
    addInline: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: spacing.md, paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border },
    fab: { position: "absolute", right: spacing.md, bottom: spacing.lg, flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: c.primary, paddingHorizontal: 16, paddingVertical: 12, borderRadius: radius.full, shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 4 },
    fabTxt: { color: "#fff", fontWeight: "700", fontSize: font.size.sm },
    modalWrap: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.45)" },
    sheet: { backgroundColor: c.background, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: spacing.md },
    sheetHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.sm },
    sheetTitle: { color: c.text, fontSize: font.size.lg, fontWeight: "800" },
    sheetLabel: { color: c.textMuted, fontSize: font.size.sm - 1, marginBottom: 2 },
    teamPick: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.full, borderWidth: 1, borderColor: c.border },
    input: { backgroundColor: c.surfaceAlt, borderRadius: radius.sm, paddingHorizontal: 12, paddingVertical: 8, color: c.text, borderWidth: 1, borderColor: c.border },
    searchBox: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: c.surfaceAlt, borderRadius: radius.md, paddingHorizontal: 12, marginTop: spacing.md, marginBottom: spacing.sm, borderWidth: 1, borderColor: c.border },
    searchInput: { flex: 1, color: c.text, paddingVertical: 10, fontSize: font.size.md },
    resultado: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8 },
    ghost: { position: "absolute", top: 0, left: 0, flexDirection: "row", alignItems: "center", gap: 8, maxWidth: 240, paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.full, backgroundColor: c.surface, borderWidth: 1, borderColor: c.primary, shadowColor: "#000", shadowOpacity: 0.25, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 8, zIndex: 999 },
    ghostTxt: { color: c.text, fontSize: font.size.sm, fontWeight: "700", flexShrink: 1 },
  });
}
