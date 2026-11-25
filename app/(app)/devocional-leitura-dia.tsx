import { ScrollView } from "@/components/navigation/DockContent";
import { Text } from "@/components/ui/Typography";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useColors } from "@/contexts/ThemeContext";
import { useT } from "@/lib/i18n";
import { subirUmNivel } from "@/lib/hierarquia";
import { mensagemDoErro } from "@/lib/erroMensagem";
import { useMembro } from "@/lib/useMembro";
import { registrarLeituraBiblia } from "@/lib/devocional";
import { useFonteLeitura } from "@/lib/useFonteLeitura";
import { ErrorState } from "@/components/ui/ErrorState";
import { ControleFonte } from "@/components/devocional/ControleFonte";
import { PassagemBiblica } from "@/components/devocional/TextoLeitura";
import { AvatarPessoa } from "@/components/devocional/AvatarPessoa";
import { dataDoDia, diaLiberado, nomeDoLivroOrdem, referenciaDoDia, versiculosDoCapitulo } from "@/lib/leituraGrupo";
import { detalheLeitura, marcarDia, textoDoDia, type LeituraDetalhe } from "@/lib/leituraGrupoApi";
import type { VersiculoLivre } from "@/lib/bibliaLivre";

/**
 * Um dia da leitura em grupo: o texto do dia, o botão "Li esse devocional" e,
 * embaixo, quem já leu e quem falta (todos os participantes veem).
 */
export default function LeituraDia() {
  const c = useColors(), s = useMemo(() => css(c), [c]), t = useT(), fonte = useFonteLeitura();
  const { membro } = useMembro();
  const params = useLocalSearchParams<{ leituraId?: string; dia?: string }>();
  const dia = Number(params.dia) || 1;
  const [l, setL] = useState<LeituraDetalhe | null>(null), [erro, setErro] = useState<string | null>(null);
  const [blocos, setBlocos] = useState<{ ref: string; texto: string }[] | null>(null), [erroTexto, setErroTexto] = useState(false);
  const [salvando, setSalvando] = useState(false), [tentativa, setTentativa] = useState(0);

  const carregar = useCallback(() => {
    if (!params.leituraId) { setErro(t("Leitura não encontrada.")); return; }
    detalheLeitura(params.leituraId).then(d => { setL(d); setErro(null); }).catch(e => setErro(mensagemDoErro(e)));
  }, [params.leituraId, t]);
  useFocusEffect(carregar);

  const trechoDoDia = l?.divisao[dia - 1];
  const chaveTexto = l && trechoDoDia ? `${l.livro_ordem}:${JSON.stringify(trechoDoDia)}` : "";
  useEffect(() => {
    if (!l || !trechoDoDia) return;
    let vivo = true;
    setBlocos(null); setErroTexto(false);
    textoDoDia(l.livro_ordem, trechoDoDia).then(partes => {
      if (!vivo) return;
      setBlocos(partes.map(({ trecho, versiculos }) => ({
        ref: (() => {
          const lv = trecho.livro ?? l.livro_ordem, nome = nomeDoLivroOrdem(lv);
          return trecho.de ? `${nome} ${trecho.cap}:${trecho.de}–${trecho.ate ?? versiculosDoCapitulo(lv, trecho.cap)}` : `${nome} ${trecho.cap}`;
        })(),
        texto: versiculos.map((v: VersiculoLivre) => `${v.verse} ${v.text}`).join(" "),
      })));
    }).catch(() => vivo && setErroTexto(true));
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chaveTexto, tentativa]);

  const eu = l?.participantes.find(p => p.membro_id === l.eu);
  const li = !!eu?.lidos.includes(dia);
  const aberto = l ? diaLiberado(l.divisao, l.data_inicio, dia, l.hoje) : false;
  const liberaEm = l ? dataDoDia(l.divisao, l.data_inicio, dia).split("-").reverse().join("/") : "";
  const leram = l?.participantes.filter(p => p.lidos.includes(dia)) ?? [];
  const faltam = l?.participantes.filter(p => !p.lidos.includes(dia)) ?? [];

  async function alternar() {
    if (!l || !aberto) return;
    setSalvando(true);
    try {
      await marcarDia(l.id, dia, !li);
      if (!li) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
        // Também entra no histórico pessoal de "Leituras da Bíblia".
        if (membro?.membroId && trechoDoDia) registrarLeituraBiblia(membro.membroId, referenciaDoDia(trechoDoDia, l.livro_ordem)).catch(() => undefined);
      }
      carregar();
    } catch (e) { Alert.alert(t("Não foi possível salvar"), mensagemDoErro(e)); }
    finally { setSalvando(false); }
  }
  const irPara = (d: number) => l && router.setParams({ dia: String(d) });

  return <SafeAreaView style={s.safe} edges={["left", "right"]}><Stack.Screen options={{ headerShown: false }} />
    <View style={s.header}><Pressable onPress={() => subirUmNivel()} hitSlop={12} style={s.back} accessibilityRole="button" accessibilityLabel={t("Voltar")}><Ionicons name="chevron-back" size={24} color={c.text} /></Pressable><Text style={s.headerTitle}>{t("Dia")} {dia}{l ? ` ${t("de")} ${l.dias}` : ""}</Text><View style={s.back} /></View>
    {erro && !l ? <ErrorState texto={erro} onRetry={carregar} /> : !l || !trechoDoDia ? <ActivityIndicator color={c.primary} style={{ marginTop: 40 }} /> :
      <ScrollView contentContainerStyle={s.content}>
        <Text style={s.eyebrow}>{l.titulo.toUpperCase()}</Text>
        <Text style={s.title}>{referenciaDoDia(trechoDoDia, l.livro_ordem)}</Text>
        <ControleFonte passo={fonte.passo} mudar={fonte.mudar} cor={c.text} fundo={c.surface} />
        {erroTexto ? <ErrorState texto={t("Não foi possível carregar o texto.")} onRetry={() => setTentativa(n => n + 1)} />
          : !blocos ? <ActivityIndicator color={c.primary} style={{ marginVertical: 24 }} />
            : blocos.map((b, i) => <PassagemBiblica key={i} referencia={b.ref} texto={b.texto} passo={fonte.passo} />)}

        <Pressable onPress={alternar} disabled={!aberto || salvando} style={[s.cta, li && s.ctaFeito, (!aberto || salvando) && s.disabled]} accessibilityRole="button">
          <Ionicons name={li ? "checkmark-circle" : aberto ? "book-outline" : "lock-closed-outline"} size={20} color={li ? c.primary : "#fff"} />
          <Text style={[s.ctaTxt, li && { color: c.primary }]}>{!aberto ? `${t("Libera em")} ${liberaEm}` : li ? t("Você leu · toque para desfazer") : t("Li esse devocional")}</Text>
        </Pressable>

        <Text style={s.secao}>{t("JÁ LERAM")} · {leram.length}</Text>
        <View style={s.card}>{leram.length === 0 ? <Text style={s.muted}>{t("Ninguém marcou ainda.")}</Text>
          : leram.map(p => <View key={p.membro_id} style={s.pessoa}><AvatarPessoa nome={p.nome} foto={p.foto_url} tamanho={30} cor={c.primary} /><Text style={[s.nome, s.flex]} numberOfLines={1}>{p.nome}</Text><Ionicons name="checkmark-circle" size={18} color="#2E9E6B" /></View>)}</View>
        <Text style={s.secao}>{t("FALTA LER")} · {faltam.length}</Text>
        <View style={s.card}>{faltam.length === 0 ? <Text style={s.muted}>{t("Todo mundo já leu.")}</Text>
          : faltam.map(p => <View key={p.membro_id} style={s.pessoa}><AvatarPessoa nome={p.nome} foto={p.foto_url} tamanho={30} cor={c.textMuted} /><Text style={[s.nome, s.flex, { color: c.textMuted }]} numberOfLines={1}>{p.nome}</Text></View>)}</View>

        <View style={s.nav}>
          <Pressable disabled={dia <= 1} onPress={() => irPara(dia - 1)} style={[s.navBtn, dia <= 1 && s.disabled]}><Ionicons name="chevron-back" size={18} color={c.text} /><Text style={s.navTxt}>{t("Anterior")}</Text></Pressable>
          <Pressable disabled={dia >= l.dias} onPress={() => irPara(dia + 1)} style={[s.navBtn, dia >= l.dias && s.disabled]}><Text style={s.navTxt}>{t("Próximo")}</Text><Ionicons name="chevron-forward" size={18} color={c.text} /></Pressable>
        </View>
      </ScrollView>}
  </SafeAreaView>;
}

const css = (c: any) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.background }, header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingVertical: 14 }, back: { width: 32, minHeight: 32, justifyContent: "center" }, headerTitle: { flex: 1, textAlign: "center", color: c.text, fontSize: 18, fontWeight: "800" },
  content: { paddingHorizontal: 20, paddingBottom: 80, gap: 12 }, eyebrow: { color: c.primary, fontSize: 11, fontWeight: "800", letterSpacing: 1.4, marginTop: 8 }, title: { color: c.text, fontSize: 26, fontWeight: "900", lineHeight: 31 },
  muted: { color: c.textMuted, fontSize: 13, paddingVertical: 8 }, secao: { color: c.textMuted, fontSize: 10, fontWeight: "800", letterSpacing: 1.4, marginTop: 10 },
  cta: { flexDirection: "row", gap: 8, backgroundColor: c.primary, padding: 16, borderRadius: 14, alignItems: "center", justifyContent: "center", marginTop: 6, borderWidth: 1.5, borderColor: c.primary }, ctaFeito: { backgroundColor: "transparent" }, ctaTxt: { color: "#fff", fontSize: 16, fontWeight: "800" }, disabled: { opacity: .5 },
  card: { backgroundColor: c.surface, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 6, borderWidth: 1, borderColor: c.border },
  pessoa: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8 }, nome: { color: c.text, fontWeight: "700" }, flex: { flex: 1 },
  nav: { flexDirection: "row", justifyContent: "space-between", marginTop: 8 }, navBtn: { flexDirection: "row", alignItems: "center", gap: 4, padding: 10 }, navTxt: { color: c.text, fontWeight: "700" },
});
