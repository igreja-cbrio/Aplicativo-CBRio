// Detalhe do grupo pro LÍDER (app de membros): info + membros do grupo +
// inscrições pendentes daquele grupo, com aceitar/recusar. Complementa a tela
// "Meus grupos" — aqui o líder VÊ quem está no grupo, mesmo sem pedido.
import { useCallback, useMemo, useState } from "react";
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
import { font, radius, spacing, type Palette } from "@/constants/theme";
import {
  getGrupoRoster, aprovarPedidoGrupo, recusarPedidoGrupo,
  type GrupoMembro, type GrupoPedido, type GrupoRoster,
} from "@/lib/api";

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
  const membros = data?.membros || [];
  const pendentes = data?.pendentes || [];
  const nome = grupo?.nome || params.nome || t("Grupo");
  const sub = grupo ? [quando(grupo.dia_semana, grupo.horario), grupo.local || grupo.bairro].filter(Boolean).join("  ·  ") : "";

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

              {/* pendentes deste grupo */}
              {pendentes.length > 0 && (
                <>
                  <Text style={styles.secLabel}>{t("Inscrições pendentes")} ({pendentes.length})</Text>
                  {pendentes.map((p) => {
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
              )}

              {/* membros */}
              <Text style={styles.secLabel}>{t("Membros")} ({membros.length})</Text>
              {membros.length === 0 ? (
                <View style={styles.card}><Text style={styles.muted}>{t("Ninguém no grupo ainda. Ao aceitar uma inscrição, a pessoa entra aqui.")}</Text></View>
              ) : (
                membros.map((m: GrupoMembro) => {
                  const wa = waLink(m.telefone);
                  const fLabel = m.funcao ? (FUNCAO[m.funcao] || null) : null;
                  const destaque = !!m.funcao && DESTAQUE.has(m.funcao);
                  return (
                    <View key={m.id} style={[styles.card, styles.membroCard]}>
                      <View style={styles.avatarSm}><Text style={styles.avatarSmTxt}>{iniciais(m.nome)}</Text></View>
                      <View style={{ flex: 1 }}>
                        <View style={styles.nomeRow}>
                          <Text style={styles.nome} numberOfLines={1}>{m.nome}</Text>
                          {fLabel && destaque && (
                            <View style={styles.papelBadge}><Text style={styles.papelTxt}>{t(fLabel)}</Text></View>
                          )}
                        </View>
                        {fLabel && !destaque ? <Text style={styles.pequeno}>{t(fLabel)}</Text> : null}
                      </View>
                      {wa ? (
                        <Pressable onPress={() => Linking.openURL(wa)} hitSlop={8} accessibilityRole="button" accessibilityLabel={`${t("WhatsApp")} ${m.nome}`}>
                          <Ionicons name="logo-whatsapp" size={22} color="#25D366" />
                        </Pressable>
                      ) : null}
                    </View>
                  );
                })
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
            {recusaAlvo && <Text style={[styles.muted, { marginBottom: spacing.sm }]}>{t("Recusar a inscrição de")} {recusaAlvo.nome}?</Text>}
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
