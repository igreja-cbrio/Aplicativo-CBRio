import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { useColors } from "@/contexts/ThemeContext";
import { useT } from "@/lib/i18n";
import { ErrorState } from "@/components/ui/ErrorState";
import { apiGet } from "@/lib/api";
import { trackEvento } from "@/lib/telemetria";
import { useMembro } from "@/lib/useMembro";
import {
  semanaDevocional,
  checkInDevocional,
  streakDevocional,
  hojeISO,
  type DevocionalItem,
  type CheckinDevocional,
} from "@/lib/devocional";
import { compartilharDevocional } from "@/lib/devocionalShare";

const DIAS_LABEL = ["S", "T", "Q", "Q", "S"]; // seg–sex

type PenseVideo = { video_id: string; titulo: string; thumbnail_url: string | null; publicado_em: string | null };

export default function DevocionalScreen() {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const t = useT();
  const { membro } = useMembro();

  const [itens, setItens] = useState<DevocionalItem[]>([]);
  const [checkins, setCheckins] = useState<CheckinDevocional[]>([]);
  const [streak, setStreak] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [falhou, setFalhou] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [obs, setObs] = useState("");
  const [celebra, setCelebra] = useState(false);
  const [compartilhando, setCompartilhando] = useState(false);
  const [pense, setPense] = useState<PenseVideo | null>(null);

  const hoje = hojeISO();
  const itensHoje = itens.filter((i) => i.data === hoje);
  const itemHoje = itensHoje[0] ?? null;
  const lidoHoje = checkins.some((c) => c.data_devocional === hoje);

  const load = useCallback(
    async (comSpinner = true) => {
      if (comSpinner) setLoading(true);
      try {
        const r = await semanaDevocional(membro?.membroId ?? null);
        setItens(r.itens);
        setCheckins(r.checkins);
        setFalhou(false);
        if (membro?.membroId) setStreak(await streakDevocional(membro.membroId));
      } catch {
        // mantém o que tem — mas sem dado NENHUM a tela precisa dizer que foi
        // erro de conexão (antes mostrava "ainda não foi publicado", mentira).
        setFalhou(true);
      }
      setLoading(false);
      setRefreshing(false);
    },
    [membro?.membroId]
  );

  useEffect(() => {
    load();
  }, [load]);

  // Último "Pense" do Pr. Pedrão (YouTube @CanalPense) — atalho de vídeo.
  useEffect(() => {
    apiGet<{ video: PenseVideo | null }>("/app/pense-ultimo")
      .then((r) => setPense(r.video))
      .catch(() => {});
  }, []);

  function abrirPense() {
    if (!pense) return;
    trackEvento("pense_aberto", { id: pense.video_id });
    Linking.openURL(`https://www.youtube.com/watch?v=${pense.video_id}`);
  }

  async function compartilhar() {
    if (!itemHoje) return;
    setCompartilhando(true);
    try {
      Haptics.selectionAsync();
      await compartilharDevocional(itemHoje);
    } catch (e) {
      Alert.alert(t("Erro"), e instanceof Error ? e.message : t("Não foi possível compartilhar."));
    }
    setCompartilhando(false);
  }

  async function concluir() {
    if (!itemHoje) return;
    if (!membro?.membroId) {
      Alert.alert(
        t("Vincule seu cadastro"),
        t("Pra registrar sua leitura, complete seu perfil com o CPF (Menu → Perfil).")
      );
      return;
    }
    setSalvando(true);
    try {
      await checkInDevocional(membro.membroId, itemHoje.id, obs);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setCelebra(true);
      setTimeout(() => setCelebra(false), 4000);
      await load(false);
    } catch (e) {
      Alert.alert(t("Erro"), e instanceof Error ? e.message : t("Não foi possível registrar."));
    }
    setSalvando(false);
  }

  // Semana: bolinhas seg–sex
  const seg = itens.length > 0 ? itens[0].data : null;
  const diasSemana = useMemo(() => {
    const base = new Date(`${hoje}T12:00:00`);
    const dow = base.getDay();
    base.setDate(base.getDate() + (dow === 0 ? -6 : 1 - dow));
    return Array.from({ length: 5 }, (_, i) => {
      const d = new Date(base);
      d.setDate(base.getDate() + i);
      const pad = (n: number) => String(n).padStart(2, "0");
      const iso = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      return {
        iso,
        label: DIAS_LABEL[i],
        lido: checkins.some((c) => c.data_devocional === iso),
        ehHoje: iso === hoje,
        temItem: itens.some((it) => it.data === iso),
      };
    });
  }, [hoje, checkins, itens, seg]);

  const lidosSemana = diasSemana.filter((d) => d.lido).length;

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(false); }} tintColor={colors.primary} />
        }
      >
        <View style={styles.header}>
          <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))} hitSlop={8} style={styles.back}>
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </Pressable>
          <Text style={styles.title}>{t("Devocional")}</Text>
          {streak > 0 && (
            <View style={styles.streakPill}>
              <Text style={styles.streakTxt}>🔥 {streak} {streak === 1 ? t("dia") : t("dias")}</Text>
            </View>
          )}
          <Pressable
            onPress={() => router.navigate("/anotacoes")}
            hitSlop={8}
            style={styles.anotacoesBtn}
            accessibilityRole="button"
            accessibilityLabel={t("Minhas anotações")}
          >
            <Ionicons name="bookmark-outline" size={20} color={colors.brandMid} />
          </Pressable>
        </View>

        {/* Progresso da semana (seg–sex) */}
        <View style={styles.semanaCard}>
          <View style={styles.semanaRow}>
            {diasSemana.map((d) => (
              <View key={d.iso} style={styles.diaCol}>
                <View
                  style={[
                    styles.diaBolha,
                    d.lido && styles.diaBolhaLida,
                    d.ehHoje && !d.lido && styles.diaBolhaHoje,
                  ]}
                >
                  {d.lido ? (
                    <Ionicons name="checkmark" size={16} color="#fff" />
                  ) : (
                    <Text style={[styles.diaLabel, d.ehHoje && { color: colors.primary }]}>{d.label}</Text>
                  )}
                </View>
              </View>
            ))}
          </View>
          <Text style={styles.semanaResumo}>
            {lidosSemana > 0
              ? `${lidosSemana}/5 ${t("nesta semana")}`
              : t("Comece sua semana com a Palavra 💙")}
          </Text>
        </View>

        {/* Atalho: último "Pense" do Pr. Pedrão (YouTube) */}
        {pense && (
          <Pressable style={styles.penseCard} onPress={abrirPense} accessibilityRole="button" accessibilityLabel={t("Assista ao Pense")}>
            <View style={styles.penseThumbWrap}>
              {pense.thumbnail_url ? (
                <Image source={{ uri: pense.thumbnail_url }} style={styles.penseThumb} />
              ) : (
                <View style={[styles.penseThumb, styles.penseThumbVazio]}>
                  <Ionicons name="logo-youtube" size={24} color="#FF0000" />
                </View>
              )}
              <View style={styles.pensePlay}><Ionicons name="play" size={18} color="#fff" /></View>
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={styles.penseLabel}>{t("Pense · Pr. Pedrão")}</Text>
              <Text style={styles.penseTitulo} numberOfLines={2}>{pense.titulo}</Text>
              <Text style={styles.penseCta}>{t("Assista ao último vídeo")} ›</Text>
            </View>
          </Pressable>
        )}

        {loading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
        ) : !itemHoje && falhou && itens.length === 0 ? (
          <ErrorState onRetry={() => load()} />
        ) : !itemHoje ? (
          <View style={styles.vazio}>
            <Ionicons name="book-outline" size={32} color={colors.textMuted} />
            <Text style={styles.vazioTitulo}>
              {new Date().getDay() === 0 || new Date().getDay() === 6
                ? t("O devocional volta segunda-feira 💙")
                : t("O devocional de hoje ainda não foi publicado.")}
            </Text>
            <Text style={styles.vazioTxt}>
              {t("Os devocionais vão de segunda a sexta. Ative as notificações pra saber quando sair.")}
            </Text>
          </View>
        ) : (
          <>
            <Text style={styles.dataLabel}>
              {new Date(`${itemHoje.data}T12:00:00`).toLocaleDateString("pt-BR", {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}
            </Text>
            {itensHoje.map((item) => (
              <View key={item.id} style={styles.cardDevocional}>
                <Text style={styles.devTitulo}>{item.titulo}</Text>
                {item.passagem && <Text style={styles.passagemRef}>{item.passagem}</Text>}
                {item.passagem_texto && (
                  <View style={styles.passagemBox}>
                    <Text style={styles.passagemTxt}>“{item.passagem_texto}”</Text>
                  </View>
                )}
                <Text style={styles.reflexao}>{item.reflexao}</Text>
                {item.aplicacao && (
                  <>
                    <Text style={styles.secao}>{t("Pra viver hoje")}</Text>
                    <Text style={styles.reflexao}>{item.aplicacao}</Text>
                  </>
                )}
                {item.oracao && (
                  <>
                    <Text style={styles.secao}>{t("Oração")}</Text>
                    <Text style={[styles.reflexao, { fontStyle: "italic" }]}>{item.oracao}</Text>
                  </>
                )}
              </View>
            ))}

            {lidoHoje ? (
              <View style={styles.feito}>
                <Ionicons name="checkmark-circle" size={22} color={colors.success} />
                <Text style={styles.feitoTxt}>
                  {celebra ? t("Leitura registrada! 🎉") : t("Você já leu hoje. Deus te abençoe! 💙")}
                </Text>
              </View>
            ) : (
              <>
                <TextInput
                  style={styles.obsInput}
                  placeholder={t("O que Deus falou com você? (opcional)")}
                  placeholderTextColor={colors.textMuted}
                  value={obs}
                  onChangeText={setObs}
                  multiline
                />
                <Pressable onPress={concluir} disabled={salvando} style={[styles.botao, salvando && { opacity: 0.6 }]}>
                  {salvando ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="checkmark" size={18} color="#fff" />
                      <Text style={styles.botaoTxt}>{t("Li o devocional de hoje")}</Text>
                    </>
                  )}
                </Pressable>
              </>
            )}

            <Pressable onPress={compartilhar} disabled={compartilhando} style={styles.compartilhar}>
              {compartilhando ? (
                <ActivityIndicator color={colors.brandMid} />
              ) : (
                <>
                  <Ionicons name="share-outline" size={18} color={colors.brandMid} />
                  <Text style={styles.compartilharTxt}>{t("Compartilhar")}</Text>
                </>
              )}
            </Pressable>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles(colors: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    content: { padding: 20, paddingBottom: 40 },
    header: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 14 },
    back: { padding: 2 },
    title: { fontSize: 24, fontWeight: "800", color: colors.text, flex: 1 },
    streakPill: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 6,
    },
    streakTxt: { color: colors.text, fontWeight: "700", fontSize: 13 },
    anotacoesBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
    },
    semanaCard: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 16,
      padding: 14,
      marginBottom: 16,
    },
    semanaRow: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 8 },
    diaCol: { alignItems: "center" },
    diaBolha: {
      width: 38,
      height: 38,
      borderRadius: 19,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.background,
      borderWidth: 1.5,
      borderColor: colors.border,
    },
    diaBolhaLida: { backgroundColor: colors.primary, borderColor: colors.primary },
    diaBolhaHoje: { borderColor: colors.primary },
    diaLabel: { color: colors.textMuted, fontWeight: "700", fontSize: 13 },
    semanaResumo: { color: colors.textMuted, fontSize: 12, textAlign: "center", marginTop: 10 },
    penseCard: {
      flexDirection: "row", gap: 12, alignItems: "center", marginTop: 14,
      backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.glassBorder,
      borderRadius: 16, padding: 10,
    },
    penseThumbWrap: { position: "relative" },
    penseThumb: { width: 116, height: 70, borderRadius: 10, backgroundColor: colors.background },
    penseThumbVazio: { alignItems: "center", justifyContent: "center" },
    pensePlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center" },
    penseLabel: { color: colors.brandMid, fontSize: 12, fontWeight: "700" },
    penseTitulo: { color: colors.text, fontSize: 14, fontWeight: "600" },
    penseCta: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
    vazio: { alignItems: "center", gap: 8, paddingVertical: 48, paddingHorizontal: 16 },
    vazioTitulo: { color: colors.text, fontSize: 15, fontWeight: "700", textAlign: "center" },
    vazioTxt: { color: colors.textMuted, fontSize: 13, textAlign: "center", lineHeight: 19 },
    cardDevocional: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 16,
      padding: 18,
      marginBottom: 16,
    },
    dataLabel: { color: colors.textMuted, fontSize: 12, textTransform: "capitalize", marginBottom: 4 },
    devTitulo: { color: colors.text, fontSize: 20, fontWeight: "800", marginBottom: 2 },
    passagemRef: { color: colors.brandMid, fontSize: 14, fontWeight: "700", marginBottom: 10 },
    passagemBox: {
      borderLeftWidth: 3,
      borderLeftColor: colors.primary,
      paddingLeft: 12,
      marginBottom: 12,
    },
    passagemTxt: { color: colors.text, fontSize: 15, lineHeight: 23, fontStyle: "italic" },
    secao: { color: colors.text, fontSize: 15, fontWeight: "800", marginTop: 14, marginBottom: 4 },
    reflexao: { color: colors.text, fontSize: 15, lineHeight: 23, opacity: 0.92 },
    obsInput: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 14,
      padding: 14,
      color: colors.text,
      fontSize: 14,
      minHeight: 64,
      textAlignVertical: "top",
      marginBottom: 12,
    },
    botao: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      backgroundColor: colors.primary,
      borderRadius: 999,
      paddingVertical: 15,
    },
    botaoTxt: { color: "#fff", fontSize: 15, fontWeight: "700" },
    feito: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 16,
      paddingVertical: 16,
      paddingHorizontal: 14,
    },
    feitoTxt: { color: colors.text, fontSize: 14, fontWeight: "600", flex: 1 },
    compartilhar: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      paddingVertical: 12,
      marginTop: 12,
    },
    compartilharTxt: { color: colors.brandMid, fontSize: 14, fontWeight: "700" },
  });
}
