import { ScrollView } from "@/components/navigation/DockContent";
import { Text } from "@/components/ui/Typography";
import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, Share, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useColors } from "@/contexts/ThemeContext";
import { useT } from "@/lib/i18n";
import { subirUmNivel } from "@/lib/hierarquia";
import { mensagemDoErro } from "@/lib/erroMensagem";
import { ErrorState } from "@/components/ui/ErrorState";
import { useDialogo } from "@/components/ui/Dialogo";
import { AvatarPessoa } from "@/components/devocional/AvatarPessoa";
import { dataDoDia, diaLiberado, livrosDaLeitura, proximaLeitura, referenciaDoDia, resumoDosLivros, textoConvite } from "@/lib/leituraGrupo";
import { detalheLeitura, sairDaLeitura, type LeituraDetalhe } from "@/lib/leituraGrupoApi";

const dataBR = (iso: string) => iso.split("-").reverse().join("/");

/**
 * Tela CENTRAL de uma leitura em grupo: a próxima leitura da pessoa, quem está
 * lendo e quanto cada um já leu, e todos os dias. Só participante abre.
 * ⚠️ Decisão do Marcos (25/11): NÃO é pacto de data. A tela nunca mostra atraso
 * nem compara com o calendário: a data só diz quando cada dia libera, e o progresso
 * é "leu X de N dias".
 */
export default function LeituraGrupo() {
  const c = useColors(), s = useMemo(() => css(c), [c]), t = useT();
  const { leituraId } = useLocalSearchParams<{ leituraId?: string }>();
  const dlg = useDialogo();
  const [l, setL] = useState<LeituraDetalhe | null>(null), [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(() => {
    if (!leituraId) { setErro(t("Leitura não encontrada.")); return; }
    detalheLeitura(leituraId).then(d => { setL(d); setErro(null); }).catch(e => setErro(mensagemDoErro(e)));
  }, [leituraId, t]);
  useFocusEffect(carregar);

  const eu = l?.participantes.find(p => p.membro_id === l.eu);
  const proxima = l ? proximaLeitura(l.divisao, l.data_inicio, eu?.lidos ?? [], l.hoje) : null;
  const leramPorDia = useMemo(() => {
    const m = new Map<number, number>();
    l?.participantes.forEach(p => p.lidos.forEach(d => m.set(d, (m.get(d) ?? 0) + 1)));
    return m;
  }, [l]);

  function convidar() {
    if (!l) return;
    Share.share({ message: textoConvite({ titulo: l.titulo, dias: l.dias, dataInicio: l.data_inicio, codigo: l.codigo, fimDeSemana: l.fim_de_semana }) }).catch(() => undefined);
  }
  async function sair() {
    if (!l) return;
    const ok = await dlg.confirmar({
      titulo: l.sou_criador ? t("Excluir leitura?") : t("Sair da leitura?"),
      mensagem: l.sou_criador ? t("A leitura some para todos os participantes.") : t("Você deixa de aparecer para o grupo."),
      acao: l.sou_criador ? t("Excluir leitura") : t("Sair da leitura"), perigo: true,
    });
    if (!ok) return;
    sairDaLeitura(l.id).then(() => router.navigate("/devocional-planos")).catch(e => Alert.alert(t("Erro"), mensagemDoErro(e)));
  }
  const abrirDia = (dia: number) => l && router.navigate({ pathname: "/devocional-leitura-dia", params: { leituraId: l.id, dia: String(dia) } });

  return <SafeAreaView style={s.safe} edges={["left", "right"]}><Stack.Screen options={{ headerShown: false }} />
    <View style={s.header}><Pressable onPress={() => subirUmNivel()} hitSlop={12} style={s.back} accessibilityRole="button" accessibilityLabel={t("Voltar")}><Ionicons name="chevron-back" size={24} color={c.text} /></Pressable><Text style={s.headerTitle}>{t("Leitura em grupo")}</Text>
      <Pressable onPress={convidar} hitSlop={12} style={s.back} accessibilityRole="button" accessibilityLabel={t("Convidar")}><Ionicons name="person-add-outline" size={21} color={c.text} /></Pressable></View>
    {erro && !l ? <ErrorState texto={erro} onRetry={carregar} /> : !l ? <ActivityIndicator color={c.primary} style={{ marginTop: 40 }} /> :
      <ScrollView contentContainerStyle={s.content}>
        <Text style={s.eyebrow}>{resumoDosLivros(livrosDaLeitura(l)).toUpperCase()}</Text>
        <Text style={s.title}>{l.titulo}</Text>
        <Text style={s.muted}>{l.dias} {l.dias === 1 ? t("dia") : t("dias")}{l.fim_de_semana === false ? ` · ${t("de segunda a sexta")}` : ""}</Text>

        {proxima?.dia ? <Pressable onPress={() => abrirDia(proxima.dia!)} style={({ pressed }) => [s.hoje, pressed && s.pressed]} accessibilityRole="button">
            <View style={s.flex}><Text style={s.hojeRotulo}>{t("SUA PRÓXIMA LEITURA")} · {t("DIA")} {proxima.dia}</Text><Text style={s.hojeTxt}>{referenciaDoDia(l.divisao[proxima.dia - 1], l.livro_ordem)}</Text></View>
            <Ionicons name="book-outline" size={30} color="#fff" />
          </Pressable>
          : proxima?.liberaEm ? <View style={s.hoje}><Ionicons name="checkmark-circle-outline" size={24} color="#fff" /><View style={s.flex}><Text style={s.hojeTxt}>{t("Tudo lido até aqui")}</Text><Text style={s.hojeSub}>{t("A próxima leitura libera em")} {dataBR(proxima.liberaEm)}</Text></View></View>
            : <View style={s.hoje}><Ionicons name="trophy-outline" size={24} color="#fff" /><Text style={[s.hojeTxt, s.flex]}>{t("Você leu todos os dias")}</Text></View>}

        <Text style={s.secao}>{t("QUEM ESTÁ LENDO")} · {l.participantes.length}</Text>
        <View style={s.card}>
          {l.participantes.map(p => {
            const pct = l.dias ? p.lidos.length / l.dias : 0;
            return <View key={p.membro_id} style={s.pessoa}>
              <AvatarPessoa nome={p.nome} foto={p.foto_url} cor={c.primary} />
              <View style={s.flex}>
                <Text style={s.nome} numberOfLines={1}>{p.nome}{p.membro_id === l.eu ? ` (${t("você")})` : ""}{p.papel === "criador" ? " · " + t("criou") : ""}</Text>
                <View style={s.barra}><View style={[s.barraCheia, { width: `${Math.round(pct * 100)}%` }]} /></View>
              </View>
              <Text style={s.conta}>{p.lidos.length}/{l.dias}</Text>
            </View>;
          })}
        </View>
        <Pressable onPress={convidar} style={({ pressed }) => [s.convidar, pressed && s.pressed]}><Ionicons name="logo-whatsapp" size={18} color={c.primary} /><Text style={s.convidarTxt}>{t("Convidar mais gente")} · {t("código")} {l.codigo}</Text></Pressable>

        <Text style={s.secao}>{t("TODOS OS DIAS")}</Text>
        <View style={s.card}>
          {l.divisao.map((d, i) => {
            const dia = i + 1, aberto = diaLiberado(l.divisao, l.data_inicio, dia, l.hoje), meu = eu?.lidos.includes(dia);
            return <Pressable key={dia} onPress={() => abrirDia(dia)} style={({ pressed }) => [s.diaLinha, pressed && s.pressed]} accessibilityRole="button">
              <Ionicons name={meu ? "checkmark-circle" : aberto ? "ellipse-outline" : "lock-closed-outline"} size={20} color={meu ? "#2E9E6B" : c.textMuted} />
              <View style={s.flex}><Text style={[s.diaTitulo, dia === proxima?.dia && { color: c.primary }]}>{t("Dia")} {dia} · {referenciaDoDia(d, l.livro_ordem)}</Text>
                <Text style={s.diaSub}>{aberto ? `${leramPorDia.get(dia) ?? 0}/${l.participantes.length} ${t("leram")}` : `${t("Libera em")} ${dataBR(dataDoDia(l.divisao, l.data_inicio, dia))}`}</Text></View>
              <Ionicons name="chevron-forward" size={18} color={c.textMuted} />
            </Pressable>;
          })}
        </View>
        <Pressable onPress={sair} style={s.sair}><Text style={s.sairTxt}>{l.sou_criador ? t("Excluir leitura") : t("Sair da leitura")}</Text></Pressable>
      </ScrollView>}
    <dlg.Dialogo />
  </SafeAreaView>;
}

const css = (c: any) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.background }, header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingVertical: 14 }, back: { width: 32, minHeight: 32, justifyContent: "center" }, headerTitle: { flex: 1, textAlign: "center", color: c.text, fontSize: 18, fontWeight: "800" },
  content: { paddingHorizontal: 20, paddingBottom: 80, gap: 12 }, eyebrow: { color: c.primary, fontSize: 11, fontWeight: "800", letterSpacing: 1.4, marginTop: 8 }, title: { color: c.text, fontSize: 28, fontWeight: "900", lineHeight: 33 }, muted: { color: c.textMuted, fontSize: 13, lineHeight: 19 },
  hoje: { backgroundColor: c.primary, borderRadius: 20, padding: 18, flexDirection: "row", alignItems: "center", gap: 12, marginTop: 6 }, hojeRotulo: { color: "rgba(255,255,255,.8)", fontSize: 11, fontWeight: "800", letterSpacing: 1.2 }, hojeTxt: { color: "#fff", fontSize: 20, fontWeight: "900", marginTop: 2 }, hojeSub: { color: "rgba(255,255,255,.85)", fontSize: 13, marginTop: 4 },
  secao: { color: c.textMuted, fontSize: 10, fontWeight: "800", letterSpacing: 1.4, marginTop: 12 },
  card: { backgroundColor: c.surface, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 6, borderWidth: 1, borderColor: c.border },
  pessoa: { flexDirection: "row", alignItems: "center", gap: 11, paddingVertical: 9 }, nome: { color: c.text, fontWeight: "700" }, conta: { color: c.textMuted, fontWeight: "800", fontSize: 13 },
  barra: { height: 6, borderRadius: 3, backgroundColor: c.background, marginTop: 6, overflow: "hidden" }, barraCheia: { height: 6, borderRadius: 3, backgroundColor: c.primary },
  convidar: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, padding: 13, borderRadius: 14, borderWidth: 1, borderColor: c.primary }, convidarTxt: { color: c.primary, fontWeight: "800" },
  diaLinha: { flexDirection: "row", alignItems: "center", gap: 11, paddingVertical: 11, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border }, diaTitulo: { color: c.text, fontWeight: "700" }, diaSub: { color: c.textMuted, fontSize: 12, marginTop: 2 },
  flex: { flex: 1 }, pressed: { opacity: .7 }, sair: { alignItems: "center", padding: 14, marginTop: 8 }, sairTxt: { color: "#A44343", fontWeight: "800" },
});
