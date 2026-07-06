import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
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
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  const t = iso.match(/T(\d{2}):(\d{2})/);
  if (!m) return iso;
  const dias = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
  const d = new Date(iso);
  const dow = isNaN(d.getTime()) ? "" : dias[d.getUTCDay()] + " ";
  return `${dow}${m[3]}/${m[2]}${t ? ` ${t[1]}:${t[2]}` : ""}`;
}

export default function EscalaSupervisorScreen() {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const router = useRouter();

  const [servicos, setServicos] = useState<EscalaServico[]>([]);
  const [areas, setAreas] = useState<string[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const [servicoSel, setServicoSel] = useState<EscalaServico | null>(null);
  const [escala, setEscala] = useState<EscalaItem[]>([]);
  const [carregandoEscala, setCarregandoEscala] = useState(false);

  const [addTeam, setAddTeam] = useState<string | null>(null); // equipe onde estou adicionando
  const [busca, setBusca] = useState("");
  const [resultados, setResultados] = useState<PoolVoluntario[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const r = await getEscalaServicos();
        setServicos(r.servicos || []);
        setAreas(r.areas || []);
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
    setAddTeam(null); setBusca(""); setResultados([]);
    carregarEscala(s.id);
  }

  const grupos = useMemo(() => {
    const m = new Map<string, EscalaItem[]>();
    for (const e of escala) {
      const k = e.team_name || "Sem equipe";
      (m.get(k) || m.set(k, []).get(k))!.push(e);
    }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0], "pt-BR"));
  }, [escala]);

  async function buscar(q: string) {
    setBusca(q);
    if (q.trim().length < 2) { setResultados([]); return; }
    setBuscando(true);
    try { setResultados(await buscarEscalaPool(q.trim())); }
    catch { setResultados([]); }
    finally { setBuscando(false); }
  }

  async function adicionar(vol: PoolVoluntario) {
    if (!servicoSel || !addTeam) return;
    setSalvando(true);
    try {
      await adicionarNaEscala({ service_id: servicoSel.id, volunteer_id: vol.id, team_name: addTeam === "Sem equipe" ? undefined : addTeam });
      setBusca(""); setResultados([]); setAddTeam(null);
      await carregarEscala(servicoSel.id);
    } catch (e: any) { Alert.alert("Erro", e?.message || "Erro ao escalar"); }
    finally { setSalvando(false); }
  }

  function remover(item: EscalaItem) {
    Alert.alert("Remover da escala", `Tirar ${item.volunteer_name} da escala?`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Remover", style: "destructive", onPress: async () => {
          try { await removerDaEscala(item.id); if (servicoSel) await carregarEscala(servicoSel.id); }
          catch (e: any) { Alert.alert("Erro", e?.message || "Erro ao remover"); }
        },
      },
    ]);
  }

  const statusInfo = (s: string | null) => {
    if (s === "confirmed") return { cor: "#22c55e", label: "confirmado" };
    if (s === "declined") return { cor: "#ef4444", label: "recusou" };
    return { cor: colors.textMuted, label: "pendente" };
  };

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
        <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: 60 }}>
          {areas.length > 0 && (
            <Text style={styles.areaChip}>Supervisão: {areas.join(", ")}</Text>
          )}

          {/* Seletor de culto */}
          <Text style={styles.section}>Escolha o culto</Text>
          <View style={{ gap: 8 }}>
            {servicos.length === 0 && <Text style={styles.muted}>Nenhum culto próximo.</Text>}
            {servicos.map(s => {
              const ativo = servicoSel?.id === s.id;
              return (
                <Pressable key={s.id} onPress={() => selecionar(s)}
                  style={[styles.servico, ativo && { borderColor: colors.primary, backgroundColor: colors.primary + "18" }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.servicoNome}>{s.service_type_name || "Culto"}</Text>
                    <Text style={styles.muted}>{fmtData(s.scheduled_at)}</Text>
                  </View>
                  {ativo && <Ionicons name="checkmark-circle" size={20} color={colors.primary} />}
                </Pressable>
              );
            })}
          </View>

          {/* Escala do culto selecionado */}
          {servicoSel && (
            <View style={{ marginTop: spacing.lg }}>
              <Text style={styles.section}>Escala · {servicoSel.service_type_name}</Text>
              {carregandoEscala ? (
                <ActivityIndicator color={colors.primary} style={{ marginTop: 16 }} />
              ) : (
                <>
                  {grupos.length === 0 && <Text style={styles.muted}>Ninguém escalado ainda.</Text>}
                  {grupos.map(([team, lista]) => (
                    <View key={team} style={styles.teamCard}>
                      <Text style={styles.teamNome}>{team} · {lista.length}</Text>
                      {lista.map(item => {
                        const si = statusInfo(item.confirmation_status);
                        return (
                          <View key={item.id} style={styles.pessoa}>
                            <View style={{ flex: 1 }}>
                              <Text style={styles.pessoaNome}>{item.volunteer_name}</Text>
                              <Text style={[styles.pequeno, { color: si.cor }]}>
                                {si.label}{item.position_name ? ` · ${item.position_name}` : ""}
                              </Text>
                            </View>
                            <Pressable onPress={() => remover(item)} hitSlop={8}>
                              <Ionicons name="close-circle" size={22} color={colors.textMuted} />
                            </Pressable>
                          </View>
                        );
                      })}
                      {/* Adicionar a esta equipe */}
                      {addTeam === team ? (
                        <View style={styles.addBox}>
                          <TextInput
                            style={styles.input}
                            placeholder="Buscar voluntário…"
                            placeholderTextColor={colors.textMuted}
                            value={busca}
                            onChangeText={buscar}
                            autoFocus
                          />
                          {buscando && <ActivityIndicator color={colors.primary} style={{ marginVertical: 6 }} />}
                          {resultados.map(v => (
                            <Pressable key={v.id} style={styles.resultado} disabled={salvando} onPress={() => adicionar(v)}>
                              <Ionicons name="person-add" size={16} color={colors.primary} />
                              <Text style={styles.pessoaNome}>{v.full_name}</Text>
                            </Pressable>
                          ))}
                          <Pressable onPress={() => { setAddTeam(null); setBusca(""); setResultados([]); }}>
                            <Text style={[styles.pequeno, { color: colors.textMuted, marginTop: 6 }]}>Cancelar</Text>
                          </Pressable>
                        </View>
                      ) : (
                        <Pressable onPress={() => { setAddTeam(team); setBusca(""); setResultados([]); }} style={styles.addBtn}>
                          <Ionicons name="add" size={18} color={colors.primary} />
                          <Text style={[styles.pequeno, { color: colors.primary }]}>Adicionar a {team}</Text>
                        </Pressable>
                      )}
                    </View>
                  ))}
                </>
              )}
            </View>
          )}
        </ScrollView>
      )}
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
    areaChip: { color: c.textMuted, fontSize: font.size.sm, marginBottom: spacing.sm },
    section: { color: c.text, fontSize: font.size.md, fontWeight: "700", marginBottom: spacing.sm, marginTop: spacing.xs },
    servico: { flexDirection: "row", alignItems: "center", gap: 8, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface },
    servicoNome: { color: c.text, fontSize: font.size.sm, fontWeight: "600" },
    teamCard: { backgroundColor: c.surface, borderRadius: radius.md, borderWidth: 1, borderColor: c.border, padding: spacing.md, marginBottom: spacing.sm },
    teamNome: { color: c.text, fontSize: font.size.sm, fontWeight: "700", marginBottom: 8 },
    pessoa: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 6, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border },
    pessoaNome: { color: c.text, fontSize: font.size.sm, flexShrink: 1 },
    addBtn: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 8 },
    addBox: { marginTop: 8, gap: 4 },
    input: { backgroundColor: c.surfaceAlt, borderRadius: radius.sm, paddingHorizontal: 12, paddingVertical: 8, color: c.text, borderWidth: 1, borderColor: c.border },
    resultado: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 8, paddingHorizontal: 4 },
  });
}
