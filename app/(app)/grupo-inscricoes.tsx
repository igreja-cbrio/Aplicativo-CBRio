import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator, Alert, KeyboardAvoidingView, Linking, Modal, Platform,
  Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Stack, useFocusEffect, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { useColors } from "@/contexts/ThemeContext";
import { useT } from "@/lib/i18n";
import { font, radius, spacing, type Palette } from "@/constants/theme";
import {
  listarPedidosGrupo, aprovarPedidoGrupo, recusarPedidoGrupo,
  type GrupoPedido,
} from "@/lib/api";

function waLink(tel: string | null): string | null {
  if (!tel) return null;
  let d = String(tel).replace(/\D/g, "");
  if (!d) return null;
  if (d.length <= 11 && !d.startsWith("55")) d = "55" + d;
  return `https://wa.me/${d}`;
}

const DIA_MS = 86400000;
function haQuantoTempo(iso: string, t: (s: string) => string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const dias = Math.floor((Date.now() - d.getTime()) / DIA_MS);
  if (dias <= 0) return t("hoje");
  if (dias === 1) return t("1 dia atrás");
  return `${dias} ${t("dias atrás")}`;
}

function iniciais(nome: string): string {
  const p = (nome || "").trim().split(/\s+/).filter(Boolean);
  if (!p.length) return "?";
  return ((p[0][0] || "") + (p.length > 1 ? p[p.length - 1][0] : "")).toUpperCase();
}

export default function GrupoInscricoesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const router = useRouter();
  const t = useT();

  const [pedidos, setPedidos] = useState<GrupoPedido[] | null>(null);
  const [multiGrupo, setMultiGrupo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [semPermissao, setSemPermissao] = useState(false);
  const [refrescando, setRefrescando] = useState(false);
  const [processandoId, setProcessandoId] = useState<string | null>(null);

  // Modal de recusa (molde escala-supervisor)
  const [recusaAlvo, setRecusaAlvo] = useState<GrupoPedido | null>(null);
  const [motivo, setMotivo] = useState("");

  const carregar = useCallback(async (silencioso = false) => {
    if (!silencioso) setErro(null);
    try {
      const r = await listarPedidosGrupo();
      const lista = r.pedidos || [];
      setPedidos(lista);
      setSemPermissao(false);
      setErro(null);
      // Mostra o nome do grupo em cada card só quando há mais de um grupo em jogo.
      setMultiGrupo(new Set(lista.map((p) => p.grupo_id)).size > 1);
    } catch (e: any) {
      const status = (e as { status?: number })?.status;
      if (status === 403) {
        setSemPermissao(true);
        setPedidos([]);
      } else {
        setErro(e?.message || t("Erro ao carregar as inscrições."));
        if (pedidos === null) setPedidos([]);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t]);

  useFocusEffect(useCallback(() => { carregar(); }, [carregar]));

  async function refrescar() {
    setRefrescando(true);
    try { await carregar(true); } finally { setRefrescando(false); }
  }

  function aceitar(p: GrupoPedido) {
    Alert.alert(
      t("Aceitar inscrição"),
      `${t("Aprovar")} ${p.nome} ${t("no grupo")} ${p.grupo_nome}?`,
      [
        { text: t("Cancelar"), style: "cancel" },
        {
          text: t("Aceitar"),
          onPress: async () => {
            setProcessandoId(p.id);
            try {
              await aprovarPedidoGrupo(p.id);
              setPedidos((prev) => (prev || []).filter((x) => x.id !== p.id));
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
            } catch (e: any) {
              Alert.alert(t("Erro"), e?.message || t("Não foi possível aprovar."));
            } finally { setProcessandoId(null); }
          },
        },
      ],
    );
  }

  function abrirRecusa(p: GrupoPedido) {
    setRecusaAlvo(p);
    setMotivo("");
  }

  async function confirmarRecusa() {
    const p = recusaAlvo;
    if (!p) return;
    setProcessandoId(p.id);
    try {
      await recusarPedidoGrupo(p.id, motivo.trim());
      setPedidos((prev) => (prev || []).filter((x) => x.id !== p.id));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setRecusaAlvo(null);
      setMotivo("");
    } catch (e: any) {
      Alert.alert(t("Erro"), e?.message || t("Não foi possível recusar."));
    } finally { setProcessandoId(null); }
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.header}>
        <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))} hitSlop={12} accessibilityRole="button" accessibilityLabel={t("Voltar")}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </Pressable>
        <Text style={styles.title}>{t("Inscrições do grupo")}</Text>
        <View style={{ width: 26 }} />
      </View>

      {pedidos === null ? (
        <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>
      ) : semPermissao ? (
        <View style={styles.center}>
          <Ionicons name="lock-closed-outline" size={32} color={colors.textMuted} />
          <Text style={styles.muted}>{t("Esta área é só para líderes de grupo.")}</Text>
        </View>
      ) : erro ? (
        <View style={styles.center}>
          <Text style={[styles.muted, { marginBottom: 12 }]}>{erro}</Text>
          <Pressable style={styles.retry} onPress={() => { setPedidos(null); carregar(); }} accessibilityRole="button">
            <Ionicons name="refresh" size={16} color={colors.primary} />
            <Text style={[styles.pequeno, { color: colors.primary }]}>{t("Tentar de novo")}</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40, gap: spacing.md }}
          refreshControl={<RefreshControl refreshing={refrescando} onRefresh={refrescar} tintColor={colors.primary} />}
        >
          {pedidos.length === 0 ? (
            <View style={[styles.center, { paddingTop: spacing.xl * 2 }]}>
              <Ionicons name="checkmark-done-circle-outline" size={40} color={colors.textMuted} />
              <Text style={styles.muted}>{t("Nenhuma inscrição aguardando no momento.")}</Text>
            </View>
          ) : (
            pedidos.map((p) => {
              const wa = waLink(p.telefone);
              const proc = processandoId === p.id;
              return (
                <View key={p.id} style={styles.card}>
                  <View style={styles.cardHead}>
                    <View style={styles.avatar}>
                      <Text style={styles.avatarTxt}>{iniciais(p.nome)}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.nome} numberOfLines={1}>{p.nome}</Text>
                      <Text style={styles.pequeno}>{haQuantoTempo(p.created_at, t)}{p.origem ? ` · ${p.origem}` : ""}</Text>
                    </View>
                  </View>

                  {multiGrupo && (
                    <View style={styles.linha}>
                      <Ionicons name="people-outline" size={16} color={colors.textMuted} />
                      <Text style={styles.linhaTxt} numberOfLines={1}>{p.grupo_nome}</Text>
                    </View>
                  )}
                  {p.email ? (
                    <View style={styles.linha}>
                      <Ionicons name="mail-outline" size={16} color={colors.textMuted} />
                      <Text style={styles.linhaTxt} numberOfLines={1}>{p.email}</Text>
                    </View>
                  ) : null}
                  {wa ? (
                    <Pressable style={styles.linha} onPress={() => Linking.openURL(wa)} accessibilityRole="button" accessibilityLabel={`${t("WhatsApp")} ${p.telefone}`}>
                      <Ionicons name="logo-whatsapp" size={16} color="#25D366" />
                      <Text style={[styles.linhaTxt, { color: colors.primary }]} numberOfLines={1}>{p.telefone}</Text>
                    </Pressable>
                  ) : null}

                  <View style={styles.acoes}>
                    <Pressable
                      style={[styles.btn, styles.btnRecusar]}
                      disabled={proc}
                      onPress={() => abrirRecusa(p)}
                      accessibilityRole="button"
                      accessibilityLabel={`${t("Recusar")} ${p.nome}`}
                    >
                      <Ionicons name="close" size={18} color={colors.danger} />
                      <Text style={[styles.btnTxt, { color: colors.danger }]}>{t("Recusar")}</Text>
                    </Pressable>
                    <Pressable
                      style={[styles.btn, styles.btnAceitar]}
                      disabled={proc}
                      onPress={() => aceitar(p)}
                      accessibilityRole="button"
                      accessibilityLabel={`${t("Aceitar")} ${p.nome}`}
                    >
                      {proc ? <ActivityIndicator color="#fff" size="small" /> : (
                        <>
                          <Ionicons name="checkmark" size={18} color="#fff" />
                          <Text style={[styles.btnTxt, { color: "#fff" }]}>{t("Aceitar")}</Text>
                        </>
                      )}
                    </Pressable>
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>
      )}

      {/* Modal de recusa · motivo (molde escala-supervisor) */}
      <Modal visible={!!recusaAlvo} animationType="slide" transparent statusBarTranslucent onRequestClose={() => setRecusaAlvo(null)}>
        <KeyboardAvoidingView style={styles.modalWrap} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <View style={[styles.sheet, { paddingBottom: spacing.md + insets.bottom }]}>
            <View style={styles.sheetHead}>
              <Text style={styles.sheetTitle}>{t("Recusar inscrição")}</Text>
              <Pressable onPress={() => setRecusaAlvo(null)} hitSlop={12} accessibilityRole="button" accessibilityLabel={t("Fechar")}>
                <Ionicons name="close" size={24} color={colors.text} />
              </Pressable>
            </View>
            {recusaAlvo && (
              <Text style={[styles.muted, { marginBottom: spacing.sm }]}>
                {t("Recusar a inscrição de")} {recusaAlvo.nome}?
              </Text>
            )}
            <Text style={styles.sheetLabel}>{t("Motivo (opcional)")}</Text>
            <TextInput
              style={styles.input}
              placeholder={t("Ex.: grupo lotado, pessoa já em outro grupo…")}
              placeholderTextColor={colors.textMuted}
              value={motivo}
              onChangeText={setMotivo}
              multiline
            />
            <Pressable
              style={[styles.btn, styles.btnRecusarSolido, { marginTop: spacing.md }]}
              disabled={!!processandoId}
              onPress={confirmarRecusa}
              accessibilityRole="button"
            >
              {processandoId ? <ActivityIndicator color="#fff" size="small" /> : (
                <Text style={[styles.btnTxt, { color: "#fff" }]}>{t("Confirmar recusa")}</Text>
              )}
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
    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
    title: { color: c.text, fontSize: font.size.lg, fontWeight: "800" },
    center: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.lg, gap: spacing.md },
    muted: { color: c.textMuted, fontSize: font.size.md, textAlign: "center" },
    pequeno: { color: c.textMuted, fontSize: font.size.sm },
    retry: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.full, borderWidth: 1, borderColor: c.primary },
    card: { backgroundColor: c.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: c.glassBorder, padding: spacing.md, gap: spacing.sm },
    cardHead: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    avatar: { height: 44, width: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: c.primary + "22" },
    avatarTxt: { color: c.primary, fontWeight: "800", fontSize: font.size.md },
    nome: { color: c.text, fontSize: font.size.md, fontWeight: "800" },
    linha: { flexDirection: "row", alignItems: "center", gap: 8 },
    linhaTxt: { color: c.textMuted, fontSize: font.size.sm, flex: 1 },
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
