import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useColors } from "@/contexts/ThemeContext";
import { font, radius, spacing, type Palette } from "@/constants/theme";
import {
  getEscalaServicos, getEscala, buscarEscalaPool, adicionarNaEscala, removerDaEscala,
  type EscalaServico, type EscalaItem, type PoolVoluntario,
} from "@/lib/api";

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
  return `${dias[brt.getUTCDay()]} ${dd}/${mm} ${hh}:${mi}`;
}
function iniciais(nome: string): string {
  const p = (nome || "").trim().split(/\s+/).filter(Boolean);
  if (!p.length) return "?";
  return ((p[0][0] || "") + (p.length > 1 ? p[p.length - 1][0] : "")).toUpperCase();
}

export default function EscalaSupervisorScreen() {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const router = useRouter();

  const [servicos, setServicos] = useState<EscalaServico[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const [servicoSel, setServicoSel] = useState<EscalaServico | null>(null);
  const [escala, setEscala] = useState<EscalaItem[]>([]);
  const [carregandoEscala, setCarregandoEscala] = useState(false);
  const [recolhidos, setRecolhidos] = useState<Set<string>>(new Set());

  // Modal de adicionar
  const [addOpen, setAddOpen] = useState(false);
  const [addTeam, setAddTeam] = useState<string>("");
  const [novaEquipe, setNovaEquipe] = useState("");
  const [busca, setBusca] = useState("");
  const [resultados, setResultados] = useState<PoolVoluntario[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [salvandoId, setSalvandoId] = useState<string | null>(null);
  const buscaTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const r = await getEscalaServicos();
        setServicos(r.servicos || []);
      } catch (e: any) {
        setErro(e?.message || "Erro ao carregar cultos");
      } finally { setCarregando(false); }
    })();
  }, []);

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

  function toggle(team: string) {
    setRecolhidos(prev => { const n = new Set(prev); n.has(team) ? n.delete(team) : n.add(team); return n; });
  }

  // Busca com debounce (300ms) — evita disparar a cada tecla.
  function onBusca(q: string) {
    setBusca(q);
    if (buscaTimer.current) clearTimeout(buscaTimer.current);
    if (q.trim().length < 2) { setResultados([]); setBuscando(false); return; }
    setBuscando(true);
    buscaTimer.current = setTimeout(async () => {
      try { setResultados(await buscarEscalaPool(q.trim())); }
      catch { setResultados([]); }
      finally { setBuscando(false); }
    }, 300);
  }

  function abrirAdd(team?: string) {
    setAddTeam(team || equipes[0] || "Sem equipe");
    setNovaEquipe(""); setBusca(""); setResultados([]);
    setAddOpen(true);
  }

  const jaEscalados = useMemo(() => new Set(escala.map(e => e.volunteer_id).filter(Boolean)), [escala]);

  async function adicionar(vol: PoolVoluntario) {
    if (!servicoSel) return;
    const team = (novaEquipe.trim() || addTeam);
    setSalvandoId(vol.id);
    try {
      await adicionarNaEscala({ service_id: servicoSel.id, volunteer_id: vol.id, team_name: team === "Sem equipe" ? undefined : team });
      await carregarEscala(servicoSel.id);
      // mantém o painel aberto pra adicionar vários seguidos; limpa a busca.
      setBusca(""); setResultados([]);
    } catch (e: any) { Alert.alert("Erro", e?.message || "Erro ao escalar"); }
    finally { setSalvandoId(null); }
  }

  function remover(item: EscalaItem) {
    Alert.alert("Remover da escala", `Tirar ${item.volunteer_name} da escala?`, [
      { text: "Cancelar", style: "cancel" },
      { text: "Remover", style: "destructive", onPress: async () => {
        try { await removerDaEscala(item.id); if (servicoSel) await carregarEscala(servicoSel.id); }
        catch (e: any) { Alert.alert("Erro", e?.message || "Erro ao remover"); }
      } },
    ]);
  }

  const statusInfo = (s: string | null) =>
    s === "confirmed" ? { cor: "#22c55e", label: "confirmado" }
    : s === "declined" ? { cor: "#ef4444", label: "recusou" }
    : { cor: colors.textMuted, label: "pendente" };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10}><Ionicons name="chevron-back" size={26} color={colors.text} /></Pressable>
        <Text style={styles.title}>Montar escala</Text>
        <View style={{ width: 26 }} />
      </View>

      {carregando ? (
        <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>
      ) : erro ? (
        <View style={styles.center}><Text style={styles.muted}>{erro}</Text></View>
      ) : (
        <>
          {/* Seletor de culto · chips horizontais (compacto) */}
          <View style={styles.cultoBar}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: spacing.md, gap: 8 }}>
              {servicos.length === 0 && <Text style={styles.muted}>Nenhum culto próximo.</Text>}
              {servicos.map(s => {
                const ativo = servicoSel?.id === s.id;
                return (
                  <Pressable key={s.id} onPress={() => selecionar(s)}
                    style={[styles.cultoChip, ativo && { borderColor: colors.primary, backgroundColor: colors.primary }]}>
                    <Text style={[styles.cultoChipNome, ativo && { color: "#fff" }]} numberOfLines={1}>{s.service_type_name || "Culto"}</Text>
                    <Text style={[styles.cultoChipData, ativo && { color: "#fff" }]}>{fmtData(s.scheduled_at)}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          {!servicoSel ? (
            <View style={styles.center}><Text style={styles.muted}>Escolha um culto acima pra montar a escala.</Text></View>
          ) : carregandoEscala ? (
            <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>
          ) : (
            <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: 100, gap: 8 }}>
              {grupos.length === 0 ? (
                <Text style={styles.muted}>Ninguém escalado ainda. Toque em “Adicionar” pra começar.</Text>
              ) : grupos.map(([team, lista]) => {
                const aberto = !recolhidos.has(team);
                const conf = lista.filter(x => x.confirmation_status === "confirmed").length;
                return (
                  <View key={team} style={styles.teamCard}>
                    <Pressable style={styles.teamHead} onPress={() => toggle(team)}>
                      <Ionicons name={aberto ? "chevron-down" : "chevron-forward"} size={18} color={colors.textMuted} />
                      <Text style={styles.teamNome} numberOfLines={1}>{team}</Text>
                      <View style={styles.badge}><Text style={styles.badgeTxt}>{conf}/{lista.length}</Text></View>
                    </Pressable>
                    {aberto && (
                      <View>
                        {lista.map(item => {
                          const si = statusInfo(item.confirmation_status);
                          return (
                            <View key={item.id} style={styles.pessoa}>
                              <View style={[styles.avatar, { backgroundColor: si.cor + "22" }]}>
                                <Text style={[styles.avatarTxt, { color: si.cor }]}>{iniciais(item.volunteer_name)}</Text>
                              </View>
                              <View style={{ flex: 1 }}>
                                <Text style={styles.pessoaNome} numberOfLines={1}>{item.volunteer_name}</Text>
                                <Text style={[styles.pequeno, { color: si.cor }]}>{si.label}{item.position_name ? ` · ${item.position_name}` : ""}</Text>
                              </View>
                              <Pressable onPress={() => remover(item)} hitSlop={8}><Ionicons name="close-circle" size={22} color={colors.textMuted} /></Pressable>
                            </View>
                          );
                        })}
                        <Pressable onPress={() => abrirAdd(team)} style={styles.addInline}>
                          <Ionicons name="add" size={16} color={colors.primary} />
                          <Text style={[styles.pequeno, { color: colors.primary }]}>Adicionar a {team}</Text>
                        </Pressable>
                      </View>
                    )}
                  </View>
                );
              })}
            </ScrollView>
          )}

          {/* Botão flutuante · adicionar voluntário */}
          {servicoSel && !carregandoEscala && (
            <Pressable style={styles.fab} onPress={() => abrirAdd()}>
              <Ionicons name="person-add" size={20} color="#fff" />
              <Text style={styles.fabTxt}>Adicionar</Text>
            </Pressable>
          )}
        </>
      )}

      {/* Modal de adicionar · busca única com debounce + seletor de equipe */}
      <Modal visible={addOpen} animationType="slide" transparent onRequestClose={() => setAddOpen(false)}>
        <View style={styles.modalWrap}>
          <View style={styles.sheet}>
            <View style={styles.sheetHead}>
              <Text style={styles.sheetTitle}>Adicionar voluntário</Text>
              <Pressable onPress={() => setAddOpen(false)} hitSlop={10}><Ionicons name="close" size={24} color={colors.text} /></Pressable>
            </View>

            {/* Equipe destino */}
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
            <TextInput style={[styles.input, { marginTop: 6 }]} placeholder="…ou nova equipe" placeholderTextColor={colors.textMuted}
              value={novaEquipe} onChangeText={setNovaEquipe} />

            {/* Busca */}
            <View style={styles.searchBox}>
              <Ionicons name="search" size={18} color={colors.textMuted} />
              <TextInput style={styles.searchInput} placeholder="Buscar voluntário pelo nome…" placeholderTextColor={colors.textMuted}
                value={busca} onChangeText={onBusca} autoFocus autoCorrect={false} />
              {buscando && <ActivityIndicator color={colors.primary} />}
            </View>

            <ScrollView style={{ maxHeight: 320 }} keyboardShouldPersistTaps="handled">
              {busca.trim().length < 2 ? (
                <Text style={[styles.muted, { padding: spacing.md, textAlign: "center" }]}>Digite ao menos 2 letras do nome.</Text>
              ) : (!buscando && resultados.length === 0) ? (
                <Text style={[styles.muted, { padding: spacing.md, textAlign: "center" }]}>Nenhum voluntário encontrado.</Text>
              ) : resultados.map(v => {
                const escalado = v.id ? jaEscalados.has(v.id) : false;
                return (
                  <Pressable key={v.id} style={styles.resultado} disabled={!!salvandoId || escalado} onPress={() => adicionar(v)}>
                    <View style={[styles.avatar, { backgroundColor: colors.primary + "22" }]}>
                      <Text style={[styles.avatarTxt, { color: colors.primary }]}>{iniciais(v.full_name)}</Text>
                    </View>
                    <Text style={[styles.pessoaNome, { flex: 1 }]} numberOfLines={1}>{v.full_name}</Text>
                    {salvandoId === v.id ? <ActivityIndicator color={colors.primary} />
                      : escalado ? <Text style={[styles.pequeno, { color: colors.textMuted }]}>já na escala</Text>
                      : <Ionicons name="add-circle" size={24} color={colors.primary} />}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>
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
    cultoBar: { paddingVertical: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border },
    cultoChip: { minWidth: 150, paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.md, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface },
    cultoChipNome: { color: c.text, fontSize: font.size.sm, fontWeight: "700" },
    cultoChipData: { color: c.textMuted, fontSize: font.size.sm - 1, marginTop: 2 },
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
    sheet: { backgroundColor: c.background, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: spacing.md, paddingBottom: spacing.xl },
    sheetHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.sm },
    sheetTitle: { color: c.text, fontSize: font.size.lg, fontWeight: "800" },
    sheetLabel: { color: c.textMuted, fontSize: font.size.sm - 1, marginBottom: 2 },
    teamPick: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.full, borderWidth: 1, borderColor: c.border },
    input: { backgroundColor: c.surfaceAlt, borderRadius: radius.sm, paddingHorizontal: 12, paddingVertical: 8, color: c.text, borderWidth: 1, borderColor: c.border },
    searchBox: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: c.surfaceAlt, borderRadius: radius.md, paddingHorizontal: 12, marginTop: spacing.md, marginBottom: spacing.sm, borderWidth: 1, borderColor: c.border },
    searchInput: { flex: 1, color: c.text, paddingVertical: 10, fontSize: font.size.md },
    resultado: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8 },
  });
}
