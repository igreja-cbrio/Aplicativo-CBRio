import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useColors } from "@/contexts/ThemeContext";
import { useT } from "@/lib/i18n";
import { useMembro } from "@/lib/useMembro";
import { useDialogo } from "@/components/ui/Dialogo";
import { ErrorState } from "@/components/ui/ErrorState";
import { ControleFonte } from "@/components/devocional/ControleFonte";
import { PassagemBiblica, TextoDevocional } from "@/components/devocional/TextoLeitura";
import { VideoDevocional } from "@/components/devocional/VideoDevocional";
import { subirUmNivel } from "@/lib/hierarquia";
import { trackEvento } from "@/lib/telemetria";
import { useFonteLeitura } from "@/lib/useFonteLeitura";
import { checkInDevocional, itemDoPlano, leiturasDoPlano, mensagemDoErro, salvarRegistroPessoal, type ItemEdicao } from "@/lib/devocional";
import { compartilharDevocional } from "@/lib/devocionalShare";

/**
 * Um DIA de um plano por inscrição (ex.: "Dia 2 de 5 · Valores de Cristo").
 * O check-in grava em devocional_leituras_planos (o que libera o dia seguinte
 * em /devocional-plano) E em mem_devocionais (o KPI do valor Investir) — a
 * mesma `checkInDevocional` do diário; segunda régua aqui divergiria.
 * A passagem sai em "papel" (a estética da aba Bíblia) e o texto em
 * parágrafos curtos, com A−/A+ compartilhado com a Bíblia (24/09/2026).
 */
export default function PlanoDiaScreen() {
  const c = useColors(), s = useMemo(() => css(c), [c]), t = useT();
  const { membro } = useMembro();
  const dlg = useDialogo();
  const fonte = useFonteLeitura();
  const { planoId, itemId, numero, total, titulo } = useLocalSearchParams<{ planoId?: string; itemId?: string; numero?: string; total?: string; titulo?: string }>();
  const [item, setItem] = useState<ItemEdicao | null>(null);
  const [lido, setLido] = useState(false);
  const [loading, setLoading] = useState(true);
  const [falhou, setFalhou] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [celebra, setCelebra] = useState(false);
  const [compartilhando, setCompartilhando] = useState(false);
  const [versoSelecionado, setVersoSelecionado] = useState(false);

  const load = useCallback(async () => {
    if (!itemId) { setLoading(false); return; }
    setLoading(true);
    try {
      const membroId = membro?.membroId ?? null;
      const [it, lidos] = await Promise.all([
        itemDoPlano(itemId),
        membroId && planoId ? leiturasDoPlano(membroId, planoId) : Promise.resolve([] as string[]),
      ]);
      setItem(it); setLido(lidos.includes(itemId)); setFalhou(false);
    } catch { setFalhou(true); }
    setLoading(false);
  }, [itemId, planoId, membro?.membroId]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function concluir() {
    if (!item) return;
    if (!membro?.membroId) {
      await dlg.avisar(t("Vincule seu cadastro"), t("Pra registrar sua leitura, complete seu perfil com o CPF (Menu → Perfil)."));
      return;
    }
    setSalvando(true);
    try {
      await checkInDevocional(membro.membroId, item.id);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      trackEvento("devocional_plano_dia_lido", { entity_id: item.id });
      setLido(true); setCelebra(true);
      setTimeout(() => setCelebra(false), 4000);
    } catch (e) {
      // Grava DIRETO no Supabase — sem telemetria a falha só aparece quando alguém reporta.
      // `reason` = código + texto do PostgREST (nunca dado da pessoa).
      const motivo = mensagemDoErro(e);
      trackEvento("devocional_checkin_erro", { screen: "devocional-plano-dia", reason: motivo });
      Alert.alert(t("Não foi possível registrar."), motivo);
    }
    setSalvando(false);
  }

  async function compartilhar() {
    if (!item) return;
    setCompartilhando(true);
    try { Haptics.selectionAsync(); await compartilharDevocional(item); }
    catch (e) { Alert.alert(t("Erro"), mensagemDoErro(e) || t("Não foi possível compartilhar.")); }
    setCompartilhando(false);
  }

  const n = Number(numero) || null, tot = Number(total) || null;
  return <SafeAreaView style={s.safe} edges={["top", "left", "right"]}>
    <Stack.Screen options={{ headerShown: false }} />
    <View style={s.header}>
      <Pressable onPress={() => subirUmNivel()} hitSlop={12} style={s.back} accessibilityRole="button" accessibilityLabel={t("Voltar")}><Ionicons name="chevron-back" size={24} color={c.text} /></Pressable>
      <Text style={s.headerTitle} numberOfLines={1}>{titulo || t("Plano de leitura")}</Text>
      <ControleFonte passo={fonte.passo} mudar={fonte.mudar} cor={c.text} fundo={c.surface} />
    </View>
    {loading ? <ActivityIndicator color={c.primary} style={{ marginTop: 40 }} />
      : falhou ? <ErrorState onRetry={load} />
      : !item ? <View style={s.vazio}><Ionicons name="book-outline" size={32} color={c.textMuted} /><Text style={s.vazioTxt}>{t("Este dia ainda não foi publicado.")}</Text></View>
      : <ScrollView contentContainerStyle={s.content}>
        {n && tot ? <Text style={s.dataLabel}>{t("Dia")} {n} {t("de")} {tot}</Text> : null}
        <Text style={s.devTitulo}>{item.titulo}</Text>
        <VideoDevocional url={item.video_url} />
        {item.passagem_texto && <PassagemBiblica referencia={item.passagem} texto={item.passagem_texto} passo={fonte.passo} selecionado={versoSelecionado} onPress={() => setVersoSelecionado(!versoSelecionado)}>
          {versoSelecionado && <View style={s.verseActions}>
            <Pressable style={s.verseAction} onPress={() => router.navigate({ pathname: "/devocional-registros", params: { referencia: item.passagem ?? "", textoBiblico: item.passagem_texto ?? "", origem: "devocional", itemId: item.id } })}><Ionicons name="bookmark-outline" size={18} color="#263234" /><Text style={s.verseTxt}>{t("Salvar")}</Text></Pressable>
            <Pressable style={s.verseAction} onPress={() => router.navigate({ pathname: "/devocional-mural", params: { referencia: item.passagem ?? "", textoBiblico: item.passagem_texto ?? "", itemId: item.id } })}><Ionicons name="chatbubble-outline" size={18} color="#263234" /><Text style={s.verseTxt}>{t("Comentários")}</Text></Pressable>
            <Pressable style={s.verseAction} onPress={async () => { if (!membro?.membroId) return; await salvarRegistroPessoal({ membroId: membro.membroId, origem: "devocional", referencia: item.passagem ?? "", textoBiblico: item.passagem_texto ?? undefined, cor: "amarelo", itemId: item.id }); setVersoSelecionado(false); Alert.alert(t("Marcação salva")); }}><Ionicons name="color-fill-outline" size={18} color="#263234" /><Text style={s.verseTxt}>{t("Marcar")}</Text></Pressable>
          </View>}
        </PassagemBiblica>}
        {!item.passagem_texto && !!item.passagem && <Text style={s.passagemRef}>{item.passagem}</Text>}
        <View style={s.card}>
          <TextoDevocional texto={item.reflexao} passo={fonte.passo} cor={c.text} />
          {item.aplicacao && <><Text style={s.secao}>{t("Pra viver hoje")}</Text><TextoDevocional texto={item.aplicacao} passo={fonte.passo} cor={c.text} /></>}
          {item.oracao && <><Text style={s.secao}>{t("Oração")}</Text><TextoDevocional texto={item.oracao} passo={fonte.passo} cor={c.text} italico /></>}
        </View>
        {lido
          ? <View style={s.feito}><Ionicons name="checkmark-circle" size={22} color={c.success} /><Text style={s.feitoTxt}>{celebra ? t("Leitura registrada! 🎉") : t("Você já leu este dia. 💙")}</Text></View>
          : <Pressable onPress={concluir} disabled={salvando} style={[s.botao, salvando && { opacity: .6 }]} accessibilityRole="button">
            {salvando ? <ActivityIndicator color="#fff" /> : <><Ionicons name="checkmark" size={18} color="#fff" /><Text style={s.botaoTxt}>{t("Li este devocional")}</Text></>}
          </Pressable>}
        {lido && n && tot && n < tot && <Pressable onPress={() => subirUmNivel()} style={s.proximo} accessibilityRole="button">
          <Text style={s.proximoTxt}>{t("Voltar ao plano")}</Text><Ionicons name="arrow-forward" size={16} color={c.primary} />
        </Pressable>}
        <Pressable onPress={compartilhar} disabled={compartilhando} style={s.compartilhar} accessibilityRole="button">
          {compartilhando ? <ActivityIndicator color={c.brandMid} /> : <><Ionicons name="share-outline" size={18} color={c.brandMid} /><Text style={s.compartilharTxt}>{t("Compartilhar")}</Text></>}
        </Pressable>
      </ScrollView>}
    <dlg.Dialogo />
  </SafeAreaView>;
}

const css = (c: any) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.background },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingVertical: 14, gap: 8 }, back: { width: 32, minHeight: 32, justifyContent: "center" }, headerTitle: { flex: 1, textAlign: "center", color: c.text, fontSize: 18, fontWeight: "800" },
  content: { paddingHorizontal: 20, paddingBottom: 72 },
  dataLabel: { color: c.textMuted, fontSize: 12, fontWeight: "700", marginBottom: 6, letterSpacing: .6 },
  devTitulo: { color: c.text, fontSize: 22, fontWeight: "800", lineHeight: 28, marginBottom: 14 }, passagemRef: { color: c.brandMid, fontSize: 14, fontWeight: "700", marginBottom: 10 },
  verseActions: { flexDirection: "row", gap: 18, marginTop: 12, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "#DDD8CE" }, verseAction: { flexDirection: "row", alignItems: "center", gap: 5 }, verseTxt: { color: "#263234", fontSize: 11, fontWeight: "800" },
  card: { backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: 16, padding: 18, marginTop: 14, marginBottom: 16 },
  secao: { color: c.text, fontSize: 15, fontWeight: "800", marginTop: 16, marginBottom: 6 },
  botao: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: c.primary, borderRadius: 999, paddingVertical: 15 }, botaoTxt: { color: "#fff", fontSize: 15, fontWeight: "700" },
  feito: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: 16, paddingVertical: 16, paddingHorizontal: 14 }, feitoTxt: { color: c.text, fontSize: 14, fontWeight: "600", flex: 1 },
  proximo: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 14, marginTop: 8 }, proximoTxt: { color: c.primary, fontSize: 14, fontWeight: "800" },
  compartilhar: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 12, marginTop: 4 }, compartilharTxt: { color: c.brandMid, fontSize: 14, fontWeight: "700" },
  vazio: { alignItems: "center", gap: 8, paddingVertical: 48, paddingHorizontal: 16 }, vazioTxt: { color: c.textMuted, fontSize: 14, textAlign: "center", lineHeight: 20 },
});
