import { useCallback, useEffect, useMemo, useState } from "react";
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
import { subirUmNivel } from "@/lib/hierarquia";
import { trackEvento } from "@/lib/telemetria";
import { hojeISO, inscreverNoPlano, itensDoPlano, leiturasDoPlano, planoPorId, type ItemEdicao, type PlanoDevocional } from "@/lib/devocional";
import {
  diasDoPlano, edicaoEmFoco, edicoesDoCalendario, podeAbrirDia, progressoDoPlano, ritmoDoPlano,
  semanaEmFoco, semanasDoPlano, type DiaDoPlano,
} from "@/lib/planoRitmo";

/**
 * A tela de TODO plano de leitura (24/09 · "Valores de Cristo"; universal desde
 * 25/09 · pedido do Marcos: "essa estética universal para todos os planos,
 * inclusive o de Quarta com Deus").
 *
 * O ritmo vem do DADO (`ritmoDoPlano`, lib/planoRitmo.ts):
 *  · "ritmo" (datas sentinela): a pessoa se inscreve e o dia N só abre depois
 *    do N-1; plano longo ganha abas Semana 1, 2, 3… que avançam sozinhas.
 *  · "calendario" (Quarta com Deus, Devocional da semana): as abas são as
 *    EDIÇÕES; hoje e antes abrem, o futuro fica trancado com a data. Sem
 *    inscrição — o diário antigo nunca pediu, e pedir agora seria um toque a
 *    mais entre a pessoa e a leitura de hoje.
 */
type Aba = { chave: string; rotulo: string; lidos: number; total: number; completa: boolean; dias: DiaDoPlano<ItemEdicao>[]; inicio?: string; fim?: string };

function ddmm(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

export default function PlanoScreen() {
  const c = useColors(), s = useMemo(() => css(c), [c]), t = useT();
  const { membro } = useMembro();
  const dlg = useDialogo();
  const { planoId } = useLocalSearchParams<{ planoId?: string }>();
  const [plano, setPlano] = useState<PlanoDevocional | null>(null);
  const [itens, setItens] = useState<ItemEdicao[]>([]);
  const [lidos, setLidos] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [falhou, setFalhou] = useState(false);
  const [inscrevendo, setInscrevendo] = useState(false);

  const load = useCallback(async () => {
    if (!planoId) { setLoading(false); return; }
    setLoading(true);
    try {
      const membroId = membro?.membroId ?? null;
      const [p, its, lid] = await Promise.all([
        planoPorId(planoId, membroId),
        itensDoPlano(planoId),
        membroId ? leiturasDoPlano(membroId, planoId) : Promise.resolve([] as string[]),
      ]);
      setPlano(p); setItens(its); setLidos(lid); setFalhou(false);
    } catch { setFalhou(true); }
    setLoading(false);
  }, [planoId, membro?.membroId]);

  // Recarrega ao focar: o check-in acontece na tela do dia e esta precisa
  // refletir o dia seguinte liberado quando a pessoa volta.
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const ritmo = useMemo(() => ritmoDoPlano(itens), [itens]);
  const hoje = hojeISO();

  // "ritmo": dias em sequência, semanas por posição.
  const dias = useMemo(() => diasDoPlano(itens, lidos), [itens, lidos]);
  const progresso = useMemo(() => progressoDoPlano(dias), [dias]);

  // As abas dos dois ritmos, no mesmo formato.
  const { abas, foco } = useMemo(() => {
    if (ritmo === "calendario") {
      const eds = edicoesDoCalendario(itens, lidos, hoje);
      const lista: Aba[] = eds.map((e) => ({
        chave: e.chave, rotulo: e.titulo ?? `${t("Semana de")} ${ddmm(e.inicio)}`,
        lidos: e.lidos, total: e.dias.length, completa: e.completa, dias: e.dias, inicio: e.inicio, fim: e.fim,
      }));
      return { abas: lista, foco: edicaoEmFoco(eds, hoje) };
    }
    const sems = semanasDoPlano(dias);
    const lista: Aba[] = sems.map((x) => ({
      chave: String(x.numero), rotulo: `${t("Semana")} ${x.numero}`,
      lidos: x.lidos, total: x.dias.length, completa: x.completa, dias: x.dias,
    }));
    return { abas: lista, foco: sems.length ? String(semanaEmFoco(sems)) : null };
  }, [ritmo, itens, lidos, hoje, dias, t]);

  // A tela abre na aba em foco; quando o foco muda (fechou a semana, virou a
  // edição), a escolha manual é descartada — é isso que leva o leitor "pro
  // próximo" sozinho.
  const [abaEscolhida, setAbaEscolhida] = useState<string | null>(null);
  useEffect(() => { setAbaEscolhida(null); }, [foco]);
  const abaAberta = abas.find((a) => a.chave === (abaEscolhida ?? foco)) ?? null;
  const diasVisiveis = abaAberta ? abaAberta.dias : dias;

  const calendario = ritmo === "calendario";
  // Quem abre os dias: no calendário, todo mundo; no ritmo, o inscrito.
  const podeLer = calendario || !!plano?.inscrito;
  const atual = calendario
    ? (diasVisiveis.find((d) => d.item.data === hoje && d.estado !== "lido")
      ?? diasVisiveis.find((d) => d.estado === "atual") ?? null)
    : dias.find((d) => d.estado === "atual") ?? null;
  const lidosAba = calendario ? (abaAberta?.lidos ?? 0) : progresso.lidos;
  const totalAba = calendario ? (abaAberta?.total ?? 0) : progresso.total;

  function abrirDia(d: DiaDoPlano<ItemEdicao>) {
    if (!podeAbrirDia(d.estado)) return;
    const total = calendario ? (abaAberta?.total ?? diasVisiveis.length) : dias.length;
    router.navigate({ pathname: "/devocional-plano-dia", params: { planoId: planoId ?? "", itemId: d.item.id, numero: String(d.numero), total: String(total), titulo: plano?.titulo ?? "" } });
  }

  async function comecar() {
    if (!plano) return;
    if (!membro?.membroId) {
      await dlg.avisar(t("Vincule seu cadastro"), t("Pra registrar sua leitura, complete seu perfil com o CPF (Menu → Perfil)."));
      return;
    }
    setInscrevendo(true);
    try {
      await inscreverNoPlano(plano.id, membro.membroId);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      trackEvento("devocional_plano_inscrito", { entity_id: plano.id });
      setPlano({ ...plano, inscrito: true });
      if (atual) abrirDia(atual);
    } catch (e) {
      Alert.alert(t("Erro"), e instanceof Error ? e.message : t("Não foi possível registrar."));
    }
    setInscrevendo(false);
  }

  const eyebrow = calendario
    ? (abaAberta?.inicio && abaAberta.fim ? `${ddmm(abaAberta.inicio)} – ${ddmm(abaAberta.fim)}` : t("Plano de leitura"))
    : dias.length > 0 ? `${dias.length} ${t("dias")}` : t("Plano de leitura");
  const textoProgresso = calendario
    ? (abaAberta?.completa ? t("Você leu toda esta edição 🎉") : `${lidosAba} ${t("de")} ${totalAba} ${t("leituras nesta edição")}`)
    : progresso.concluido ? t("Você concluiu este plano 🎉") : `${t("Dia")} ${atual?.numero ?? progresso.total} ${t("de")} ${progresso.total}`;
  const rotuloBotao = calendario
    ? (atual?.item.data === hoje ? t("Ler a leitura de hoje") : t("Continuar leitura"))
    : progresso.lidos === 0 ? t("Começar pelo dia 1") : t("Continuar leitura");

  return <SafeAreaView style={s.safe} edges={["top", "left", "right"]}>
    <Stack.Screen options={{ headerShown: false }} />
    <View style={s.header}>
      <Pressable onPress={() => subirUmNivel()} hitSlop={12} style={s.back} accessibilityRole="button" accessibilityLabel={t("Voltar")}><Ionicons name="chevron-back" size={24} color={c.text} /></Pressable>
      <Text style={s.headerTitle} numberOfLines={1}>{t("Plano de leitura")}</Text>
      <View style={s.back} />
    </View>
    {loading ? <ActivityIndicator color={c.primary} style={{ marginTop: 40 }} />
      : falhou ? <ErrorState onRetry={load} />
      : !plano ? <View style={s.vazio}><Ionicons name="book-outline" size={32} color={c.textMuted} /><Text style={s.vazioTxt}>{t("Plano não encontrado.")}</Text></View>
      : <ScrollView contentContainerStyle={s.content}>
        <View style={s.hero}>
          <Text style={s.eyebrow}>{eyebrow}</Text>
          <Text style={s.title}>{plano.titulo}</Text>
          {!!plano.descricao && <Text style={s.desc}>{plano.descricao}</Text>}
          {podeLer && totalAba > 0 && <View style={s.progressoWrap}>
            <View style={s.barra}><View style={[s.barraFill, { width: `${Math.round((lidosAba / totalAba) * 100)}%` }]} /></View>
            <Text style={s.progressoTxt}>{textoProgresso}</Text>
          </View>}
          {!podeLer
            ? <Pressable onPress={comecar} disabled={inscrevendo || dias.length === 0} style={[s.botao, (inscrevendo || dias.length === 0) && { opacity: .6 }]} accessibilityRole="button">
              {inscrevendo ? <ActivityIndicator color="#fff" /> : <><Ionicons name="play" size={16} color="#fff" /><Text style={s.botaoTxt}>{t("Começar este plano")}</Text></>}
            </Pressable>
            : atual && <Pressable onPress={() => abrirDia(atual)} style={s.botao} accessibilityRole="button">
              <Ionicons name="book-outline" size={16} color="#fff" /><Text style={s.botaoTxt}>{rotuloBotao}</Text>
            </Pressable>}
        </View>
        {abas.length > (calendario ? 1 : 0) && <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.semanas}>
          {abas.map((aba) => {
            const ativa = aba.chave === abaAberta?.chave;
            return <Pressable key={aba.chave} onPress={() => setAbaEscolhida(aba.chave)} style={[s.semana, ativa && s.semanaAtiva]} accessibilityRole="tab" accessibilityState={{ selected: ativa }}>
              <Text style={[s.semanaTxt, ativa && s.semanaTxtAtiva]} numberOfLines={1}>{aba.rotulo}</Text>
              {aba.completa
                ? <Ionicons name="checkmark-circle" size={15} color={ativa ? "#fff" : c.primary} />
                : <Text style={[s.semanaSub, ativa && s.semanaTxtAtiva]}>{aba.lidos}/{aba.total}</Text>}
            </Pressable>;
          })}
        </ScrollView>}
        {itens.length === 0
          ? <Text style={s.vazioTxt}>{t("Este plano ainda não tem uma leitura publicada.")}</Text>
          : diasVisiveis.map((d) => {
            const aberto = podeLer && podeAbrirDia(d.estado);
            const destaque = calendario ? d.item.data === hoje : d.estado === "atual" && podeLer;
            const rotuloDia = calendario ? `${t("Dia")} ${d.numero} · ${ddmm(d.item.data)}` : `${t("Dia")} ${d.numero}`;
            return <Pressable key={d.item.id} onPress={() => aberto && abrirDia(d)} disabled={!aberto} style={({ pressed }) => [s.dia, destaque && s.diaAtual, !aberto && s.diaBloqueado, pressed && aberto && s.pressed]} accessibilityRole="button">
              <View style={[s.diaNum, d.estado === "lido" && s.diaNumLido]}>
                {d.estado === "lido" ? <Ionicons name="checkmark" size={16} color="#fff" /> : !aberto ? <Ionicons name="lock-closed-outline" size={14} color={c.textMuted} /> : <Text style={s.diaNumTxt}>{d.numero}</Text>}
              </View>
              <View style={s.flex}>
                <Text style={s.diaEyebrow}>{rotuloDia}{d.item.passagem ? ` · ${d.item.passagem}` : ""}</Text>
                <Text style={[s.diaTitulo, !aberto && { color: c.textMuted }]} numberOfLines={2}>{d.item.titulo}</Text>
                {!aberto && podeLer && <Text style={s.diaHint}>{calendario ? `${t("Abre em")} ${ddmm(d.item.data)}` : t("Leia o dia anterior primeiro")}</Text>}
                {!!d.item.video_url && <View style={s.temVideo}><Ionicons name="play-circle-outline" size={13} color={c.primary} /><Text style={s.temVideoTxt}>{t("Com vídeo")}</Text></View>}
              </View>
              {aberto && <Ionicons name="chevron-forward" size={20} color={c.textMuted} />}
            </Pressable>;
          })}
      </ScrollView>}
    <dlg.Dialogo />
  </SafeAreaView>;
}

const css = (c: any) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.background },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingVertical: 14 }, back: { width: 32, minHeight: 32, justifyContent: "center" }, headerTitle: { flex: 1, textAlign: "center", color: c.text, fontSize: 18, fontWeight: "800" },
  content: { paddingHorizontal: 20, paddingBottom: 72, gap: 11 },
  hero: { backgroundColor: c.primary, borderRadius: 22, padding: 20, marginBottom: 8, gap: 8 },
  eyebrow: { color: "rgba(255,255,255,.82)", fontSize: 11, fontWeight: "800", letterSpacing: 1.4 }, title: { color: "#fff", fontSize: 26, fontWeight: "900", lineHeight: 31 }, desc: { color: "rgba(255,255,255,.88)", fontSize: 14, lineHeight: 21 },
  progressoWrap: { marginTop: 6, gap: 6 }, barra: { height: 6, borderRadius: 3, backgroundColor: "rgba(255,255,255,.25)", overflow: "hidden" }, barraFill: { height: 6, borderRadius: 3, backgroundColor: "#fff" }, progressoTxt: { color: "#fff", fontSize: 13, fontWeight: "700" },
  botao: { marginTop: 8, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "rgba(255,255,255,.18)", borderWidth: 1, borderColor: "rgba(255,255,255,.45)", borderRadius: 999, paddingVertical: 13 }, botaoTxt: { color: "#fff", fontSize: 15, fontWeight: "800" },
  dia: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: c.surface, borderRadius: 18, padding: 14, borderWidth: 1, borderColor: c.border }, diaAtual: { borderColor: c.primary }, diaBloqueado: { opacity: .7 }, pressed: { opacity: .72 },
  diaNum: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: c.background, borderWidth: 1.5, borderColor: c.border }, diaNumLido: { backgroundColor: c.primary, borderColor: c.primary }, diaNumTxt: { color: c.primary, fontWeight: "800", fontSize: 14 },
  flex: { flex: 1 }, diaEyebrow: { color: c.textMuted, fontSize: 11, fontWeight: "800", letterSpacing: .8 }, diaTitulo: { color: c.text, fontSize: 15, fontWeight: "700", lineHeight: 20, marginTop: 2 }, diaHint: { color: c.textMuted, fontSize: 11, marginTop: 3 },
  semanas: { gap: 8, paddingVertical: 2, paddingRight: 4 },
  semana: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface },
  semanaAtiva: { backgroundColor: c.primary, borderColor: c.primary },
  semanaTxt: { color: c.text, fontSize: 14, fontWeight: "800" }, semanaSub: { color: c.textMuted, fontSize: 12, fontWeight: "700" }, semanaTxtAtiva: { color: "#fff" },
  temVideo: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 }, temVideoTxt: { color: c.primary, fontSize: 11, fontWeight: "700" },
  vazio: { alignItems: "center", gap: 8, paddingVertical: 48, paddingHorizontal: 16 }, vazioTxt: { color: c.textMuted, fontSize: 14, textAlign: "center", lineHeight: 20 },
});
