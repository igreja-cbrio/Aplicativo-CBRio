// Gestão da turma do NEXT pro RESPONSÁVEL (app de membros): info da turma +
// lista de inscritos (matrículas) + toggle de presença POR ENCONTRO (igual à
// web) + status de cada inscrito. Espelha app/(app)/grupo-membros.tsx.
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator, Alert, Linking, Pressable, RefreshControl,
  ScrollView, StyleSheet, Text, View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { useColors } from "@/contexts/ThemeContext";
import { useT } from "@/lib/i18n";
import { font, radius, spacing, type Palette } from "@/constants/theme";
import {
  getNextTurma, marcarPresencaNext,
  type NextMatricula, type NextTurmaDetalhe, type NextTurmaEncontro,
} from "@/lib/api";

const STATUS_LABEL: Record<string, string> = {
  matriculado: "Matriculado",
  formado: "Formado",
  incompleto: "Incompleto",
  desistiu: "Desistiu",
};

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
function nomeCompleto(m: NextMatricula): string {
  return [m.nome, m.sobrenome].filter(Boolean).join(" ").trim() || "—";
}
function rotuloEncontro(e: NextTurmaEncontro, t: (s: string) => string): string {
  if (e.tema) return e.tema;
  return `${t("Encontro")} ${e.numero ?? "?"}`;
}

export default function NextTurmaScreen() {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const router = useRouter();
  const t = useT();
  const params = useLocalSearchParams<{ id: string; nome?: string }>();
  const turmaId = String(params.id || "");

  const [data, setData] = useState<NextTurmaDetalhe | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [refrescando, setRefrescando] = useState(false);
  // chave "encontroId:matriculaId" em processamento (evita duplo toque)
  const [processando, setProcessando] = useState<string | null>(null);

  const carregar = useCallback(async (silencioso = false) => {
    if (!silencioso) setErro(null);
    try {
      const r = await getNextTurma(turmaId);
      setData(r);
      setErro(null);
    } catch (e: any) {
      const status = (e as { status?: number })?.status;
      setErro(status === 403 ? t("Você não é o responsável por esta turma.") : (e?.message || t("Erro ao carregar a turma.")));
      if (data === null) setData({ turma: null as any, encontros: [], matriculas: [], presencas: [] });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turmaId, t]);

  useFocusEffect(useCallback(() => { carregar(); }, [carregar]));

  async function refrescar() {
    setRefrescando(true);
    try { await carregar(true); } finally { setRefrescando(false); }
  }

  const turma = data?.turma;
  const encontros = data?.encontros || [];
  const matriculas = data?.matriculas || [];
  const presencas = data?.presencas || [];

  // presença por (encontro_id, matricula_id) → presente
  const presMap = useMemo(() => {
    const m = new Map<string, boolean>();
    presencas.forEach((p) => m.set(`${p.encontro_id}:${p.matricula_id}`, !!p.presente));
    return m;
  }, [presencas]);

  async function togglePresenca(enc: NextTurmaEncontro, mat: NextMatricula) {
    const chave = `${enc.id}:${mat.id}`;
    if (processando) return;
    const atual = presMap.get(chave) === true;
    const novo = !atual;
    setProcessando(chave);
    try {
      await marcarPresencaNext(enc.id, mat.id, novo);
      Haptics.selectionAsync().catch(() => {});
      await carregar(true); // recarrega presenças + status recalculado no backend
    } catch (e: any) {
      Alert.alert(t("Erro"), e?.message || t("Não foi possível marcar presença."));
    } finally {
      setProcessando(null);
    }
  }

  const nome = turma?.nome || params.nome || t("Turma");

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.header}>
        <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))} hitSlop={12} accessibilityRole="button" accessibilityLabel={t("Voltar")}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </Pressable>
        <Text style={styles.title} numberOfLines={1}>{nome}</Text>
        <View style={{ width: 26 }} />
      </View>

      {data === null ? (
        <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40, gap: spacing.md }}
          refreshControl={<RefreshControl refreshing={refrescando} onRefresh={refrescar} tintColor={colors.primary} />}
        >
          {erro && !turma ? (
            <View style={[styles.center, { paddingTop: spacing.xl }]}>
              <Ionicons name="lock-closed-outline" size={32} color={colors.textMuted} />
              <Text style={styles.muted}>{erro}</Text>
            </View>
          ) : (
            <>
              {/* resumo */}
              <View style={styles.card}>
                <View style={styles.resumoRow}>
                  <View>
                    <Text style={styles.resumoNum}>{matriculas.length}</Text>
                    <Text style={styles.pequeno}>{matriculas.length === 1 ? t("inscrito") : t("inscritos")}</Text>
                  </View>
                  <View>
                    <Text style={styles.resumoNum}>{encontros.length}</Text>
                    <Text style={styles.pequeno}>{encontros.length === 1 ? t("encontro") : t("encontros")}</Text>
                  </View>
                  <View>
                    <Text style={[styles.resumoNum, { color: colors.success }]}>{matriculas.filter((m) => m.status === "formado").length}</Text>
                    <Text style={styles.pequeno}>{t("formados")}</Text>
                  </View>
                </View>
                {!!turma?.observacoes && <Text style={[styles.linhaTxt, { marginTop: spacing.sm }]}>{turma.observacoes}</Text>}
              </View>

              {/* legenda dos encontros */}
              <Text style={styles.secLabel}>{t("Presença por encontro")}</Text>
              <View style={styles.card}>
                <Text style={styles.pequeno}>
                  {t("Toque em cada encontro pra marcar a presença do inscrito. Quem for presente em todos os encontros vira 'Formado'.")}
                </Text>
              </View>

              {/* inscritos */}
              <Text style={styles.secLabel}>{t("Inscritos")} ({matriculas.length})</Text>
              {matriculas.length === 0 ? (
                <View style={styles.card}><Text style={styles.muted}>{t("Ninguém matriculado nesta turma ainda.")}</Text></View>
              ) : (
                matriculas.map((m) => {
                  const wa = waLink(m.telefone);
                  const sLabel = m.status ? (STATUS_LABEL[m.status] || m.status) : null;
                  const formado = m.status === "formado";
                  return (
                    <View key={m.id} style={styles.card}>
                      <View style={styles.membroHead}>
                        <View style={styles.avatarSm}><Text style={styles.avatarSmTxt}>{iniciais(nomeCompleto(m))}</Text></View>
                        <View style={{ flex: 1 }}>
                          <View style={styles.nomeRow}>
                            <Text style={styles.nome} numberOfLines={1}>{nomeCompleto(m)}</Text>
                            {sLabel && (
                              <View style={[styles.statusBadge, formado ? { backgroundColor: colors.success } : null]}>
                                <Text style={[styles.statusTxt, formado ? { color: "#fff" } : null]}>{t(sLabel)}</Text>
                              </View>
                            )}
                          </View>
                        </View>
                        {wa ? (
                          <Pressable onPress={() => Linking.openURL(wa)} hitSlop={8} accessibilityRole="button" accessibilityLabel={`${t("WhatsApp")} ${nomeCompleto(m)}`}>
                            <Ionicons name="logo-whatsapp" size={22} color="#25D366" />
                          </Pressable>
                        ) : null}
                      </View>

                      {/* toggles de presença por encontro */}
                      <View style={styles.encRow}>
                        {encontros.map((enc) => {
                          const chave = `${enc.id}:${m.id}`;
                          const presente = presMap.get(chave) === true;
                          const proc = processando === chave;
                          return (
                            <Pressable
                              key={enc.id}
                              style={[styles.encChip, presente ? styles.encChipOn : null]}
                              disabled={!!processando}
                              onPress={() => togglePresenca(enc, m)}
                              accessibilityRole="checkbox"
                              accessibilityState={{ checked: presente }}
                              accessibilityLabel={`${rotuloEncontro(enc, t)} · ${nomeCompleto(m)}`}
                            >
                              {proc ? (
                                <ActivityIndicator size="small" color={presente ? "#fff" : colors.primary} />
                              ) : (
                                <Ionicons
                                  name={presente ? "checkmark-circle" : "ellipse-outline"}
                                  size={16}
                                  color={presente ? "#fff" : colors.textMuted}
                                />
                              )}
                              <Text style={[styles.encChipTxt, presente ? { color: "#fff" } : null]} numberOfLines={1}>
                                {rotuloEncontro(enc, t)}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    </View>
                  );
                })
              )}
            </>
          )}
        </ScrollView>
      )}
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
    card: { backgroundColor: c.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: c.glassBorder, padding: spacing.md, gap: spacing.sm },
    resumoRow: { flexDirection: "row", gap: spacing.xl, marginTop: spacing.xs },
    resumoNum: { color: c.text, fontSize: font.size.xl, fontWeight: "800" },
    linhaTxt: { color: c.textMuted, fontSize: font.size.sm },
    membroHead: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    avatarSm: { height: 38, width: 38, borderRadius: 19, alignItems: "center", justifyContent: "center", backgroundColor: c.primary + "1A" },
    avatarSmTxt: { color: c.primary, fontWeight: "800", fontSize: font.size.sm },
    nomeRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, flexWrap: "wrap" },
    nome: { color: c.text, fontSize: font.size.md, fontWeight: "800" },
    statusBadge: { backgroundColor: c.glass, borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 2 },
    statusTxt: { color: c.primary, fontSize: 11, fontWeight: "700" },
    encRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.xs },
    encChip: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.full, borderWidth: 1, borderColor: c.glassBorder, backgroundColor: c.surfaceAlt },
    encChipOn: { backgroundColor: c.primary, borderColor: c.primary },
    encChipTxt: { color: c.text, fontSize: font.size.sm, fontWeight: "700", maxWidth: 140 },
  });
}
