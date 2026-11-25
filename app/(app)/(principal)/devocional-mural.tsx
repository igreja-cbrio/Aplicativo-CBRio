import { ScrollView } from "@/components/navigation/DockContent";
import { Text, TextInput } from "@/components/ui/Typography";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useColors } from "@/contexts/ThemeContext";
import { useMembro } from "@/lib/useMembro";
import { listarMeusTimes, listarMural, publicarNoMural, reagirNoMural, type PostMural, type TimeServir } from "@/lib/devocional";
import { carregarCapitulo } from "@/lib/bibliaLivre";
import { CHAVE_FILTRO_MURAL, FILTRO_PADRAO, REACOES, alternarReacao, lerReferencia, normalizarFiltro, textoDosVersos, type FiltroMural, type TipoReacao } from "@/lib/muralDevocional";
import { subirUmNivel } from "@/lib/hierarquia";
import { TrechoBiblico } from "@/components/devocional/TrechoBiblico";
import { useT } from "@/lib/i18n";

// Mural dos Comentários (25/11/2026 · pedido do Marcos): o mesmo trio serve de
// FILTRO (de quem eu vejo) e de ALCANCE (quem vê o que eu publico).
const ALCANCES: { valor: FiltroMural; rotulo: string; icone: keyof typeof Ionicons.glyphMap }[] = [
  { valor: "grupo", rotulo: "Meu grupo", icone: "people-outline" },
  { valor: "servir", rotulo: "Quem serve comigo", icone: "heart-outline" },
  { valor: "igreja", rotulo: "Toda a igreja", icone: "globe-outline" },
];
const VAZIO: Record<FiltroMural, string> = {
  grupo: "Ninguém do seu grupo comentou ainda.",
  servir: "Ninguém que serve com você comentou ainda.",
  igreja: "Ainda não há comentários.",
};

export default function Mural() {
  const c = useColors(), s = useMemo(() => css(c), [c]), { membro } = useMembro(), t = useT();
  const params = useLocalSearchParams<{ referencia?: string; textoBiblico?: string; itemId?: string }>();
  const [posts, setPosts] = useState<PostMural[]>([]), [texto, setTexto] = useState("");
  // O trecho vem SEMPRE de quem chamou (Bíblia, diário, dia do plano), com referência e texto.
  const [trecho, setTrecho] = useState<{ referencia: string; texto: string; itemId?: string } | null>(null);
  // O formulário fica recolhido num botão pequeno e só abre quando a pessoa quer comentar.
  const [aberto, setAberto] = useState(false);
  useEffect(() => {
    if (params.referencia?.trim()) {
      setTrecho({ referencia: params.referencia.trim(), texto: params.textoBiblico?.trim() ?? "", itemId: params.itemId || undefined });
      setAberto(true);
    }
  }, [params.referencia, params.textoBiblico, params.itemId]);
  const [filtro, setFiltro] = useState<FiltroMural | null>(null);
  const [alcance, setAlcance] = useState<FiltroMural>(FILTRO_PADRAO), [carregando, setCarregando] = useState(true), [enviando, setEnviando] = useState(false);
  // Texto buscado na Bíblia para comentário antigo que guardou só a referência.
  const [textosBuscados, setTextosBuscados] = useState<Record<string, string>>({});
  const buscando = useRef(new Set<string>());
  // Times do Servir de quem publica: pode mandar só para um deles.
  const [times, setTimes] = useState<TimeServir[]>([]), [timeId, setTimeId] = useState<string | null>(null);
  useEffect(() => { listarMeusTimes().then(setTimes).catch(() => setTimes([])); }, []);

  // O filtro escolhido fica salvo no aparelho e volta na próxima abertura.
  useEffect(() => {
    AsyncStorage.getItem(CHAVE_FILTRO_MURAL)
      .then(v => { const f = normalizarFiltro(v); setFiltro(f); setAlcance(f); })
      .catch(() => { setFiltro(FILTRO_PADRAO); });
  }, []);
  function escolherFiltro(f: FiltroMural) {
    if (f === filtro) return;
    setFiltro(f); setAlcance(f); setCarregando(true);
    AsyncStorage.setItem(CHAVE_FILTRO_MURAL, f).catch(() => undefined);
  }

  const carregar = useCallback(async (f: FiltroMural) => {
    try { setPosts(await listarMural(f)); }
    catch (e) { Alert.alert(t("Erro"), e instanceof Error ? e.message : t("Tente novamente.")); }
    finally { setCarregando(false); }
  }, [t]);
  useEffect(() => { if (filtro) carregar(filtro); }, [filtro, carregar]);

  useEffect(() => {
    posts.forEach(p => {
      if (p.texto_biblico || p.item_passagem || buscando.current.has(p.id)) return;
      const ref = lerReferencia(p.referencia_biblica);
      if (!ref) return;
      buscando.current.add(p.id);
      carregarCapitulo(ref.livro, ref.capitulo)
        .then(vs => { const txt = textoDosVersos(vs, ref.versos); if (txt) setTextosBuscados(m => ({ ...m, [p.id]: txt })); })
        .catch(() => undefined);
    });
  }, [posts]);

  async function reagir(post: PostMural, tipo: TipoReacao) {
    const antes = { reacoes: post.reacoes ?? {}, minhas: post.minhas ?? [] };
    const depois = alternarReacao(antes, tipo);
    setPosts(ps => ps.map(p => p.id === post.id ? { ...p, ...depois } : p));
    try { await reagirNoMural(post.id, tipo); }
    catch (e) {
      setPosts(ps => ps.map(p => p.id === post.id ? { ...p, ...antes } : p));
      Alert.alert(t("Não foi possível reagir"), e instanceof Error ? e.message : t("Tente novamente."));
    }
  }

  async function publicar() {
    if (!membro?.membroId || !trecho || texto.trim().length < 2) return Alert.alert(t("Falta pouco"), t("Escolha o texto na Bíblia e escreva seu comentário."));
    setEnviando(true);
    try {
      await publicarNoMural({ membroId: membro.membroId, texto, alcance, referenciaBiblica: trecho.referencia, textoBiblico: trecho.texto, itemId: trecho.itemId, timeId });
      setTrecho(null); setTexto(""); setAberto(false); setTimeId(null); router.setParams({ referencia: undefined, textoBiblico: undefined, itemId: undefined });
      if (filtro) await carregar(filtro);
    } catch (e) { Alert.alert(t("Não foi possível publicar"), e instanceof Error ? e.message : t("Tente novamente.")); }
    finally { setEnviando(false); }
  }
  function cancelar() {
    setAberto(false); setTrecho(null); setTexto("");
    router.setParams({ referencia: undefined, textoBiblico: undefined, itemId: undefined });
  }

  return <SafeAreaView style={s.safe} edges={["left", "right"]}>
    <Stack.Screen options={{ headerShown: false }} />
    <View style={s.header}><Pressable onPress={() => subirUmNivel()} hitSlop={12} style={s.back} accessibilityRole="button" accessibilityLabel={t("Voltar")}><Ionicons name="chevron-back" size={24} color={c.text} /></Pressable><Text style={s.headerTitle}>{t("Comentários")}</Text><View style={s.back} /></View>
    <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
      <View style={s.topo}>
        <View style={s.flex}><Text style={s.eyebrow}>{t("COMUNIDADE")}</Text><Text style={s.title}>{t("Mural")}</Text></View>
        {!aberto && <Pressable style={({ pressed }) => [s.comentar, pressed && { opacity: .75 }]} onPress={() => setAberto(true)} accessibilityRole="button">
          <Ionicons name="add" size={18} color="#fff" /><Text style={s.comentarText}>{t("Comentar")}</Text>
        </Pressable>}
      </View>

      <View>
        <Text style={s.label}>{t("Ver comentários de")}</Text>
        <View style={[s.audiences, { marginTop: 7 }]}>{ALCANCES.map(a => <Pressable key={a.valor} onPress={() => escolherFiltro(a.valor)} style={[s.audience, filtro === a.valor && s.audienceOn]} accessibilityRole="button" accessibilityState={{ selected: filtro === a.valor }}><Ionicons name={a.icone} size={16} color={filtro === a.valor ? "#fff" : c.textMuted} /><Text style={[s.audienceText, filtro === a.valor && s.audienceTextOn]}>{t(a.rotulo)}</Text></Pressable>)}</View>
      </View>

      {aberto && <View style={s.composer}>
        {trecho ? <View style={s.selectedVerse}>
            <View style={s.selectedHead}><Text style={[s.ref, s.flex]}>{trecho.referencia}</Text><Pressable onPress={() => router.navigate("/biblia")} hitSlop={8} accessibilityRole="button"><Text style={s.trocar}>{t("Trocar")}</Text></Pressable></View>
            {trecho.texto ? <TrechoBiblico texto={trecho.texto} style={s.quote} corLink={c.primary} /> : null}
          </View> :
          <Pressable style={s.escolher} onPress={() => router.navigate("/biblia")} accessibilityRole="button">
            <Ionicons name="book-outline" size={20} color={c.primary} />
            <View style={s.flex}><Text style={s.escolherTitulo}>{t("Escolher o texto na Bíblia")}</Text><Text style={s.scope}>{t("Selecione os versículos e toque em Comentar.")}</Text></View>
            <Ionicons name="chevron-forward" size={18} color={c.textMuted} />
          </Pressable>}
        <TextInput style={[s.input, s.area]} value={texto} onChangeText={setTexto} placeholder={t("O que esse texto falou com você?")} placeholderTextColor={c.textMuted} multiline maxLength={1200} />
        <Text style={s.label}>{t("Quem pode ver?")}</Text>
        <View style={s.audiences}>{ALCANCES.map(a => <Pressable key={a.valor} onPress={() => setAlcance(a.valor)} style={[s.audience, alcance === a.valor && s.audienceOn]}><Ionicons name={a.icone} size={16} color={alcance === a.valor ? "#fff" : c.textMuted} /><Text style={[s.audienceText, alcance === a.valor && s.audienceTextOn]}>{t(a.rotulo)}</Text></Pressable>)}</View>
        {alcance === "servir" && (times.length ? <View style={s.audiences}>
            {[{ id: null as string | null, nome: t("Todos os meus times") }, ...times].map(x => <Pressable key={x.id ?? "todos"} onPress={() => setTimeId(x.id)} style={[s.time, timeId === x.id && s.timeOn]} accessibilityRole="button" accessibilityState={{ selected: timeId === x.id }}><Text style={[s.timeText, timeId === x.id && s.timeTextOn]}>{x.nome}</Text></Pressable>)}
          </View> : <Text style={s.scope}>{t("Você ainda não está em nenhum time do Servir.")}</Text>)}
        <Text style={s.scope}>{t("Sua publicação será identificada com seu nome.")}</Text>
        <View style={s.acoes}>
          <Pressable style={s.cancelar} onPress={cancelar} disabled={enviando} accessibilityRole="button"><Text style={s.cancelarText}>{t("Cancelar")}</Text></Pressable>
          <Pressable style={[s.cta, s.flex, enviando && s.disabled]} onPress={publicar} disabled={enviando}><Text style={s.ctaText}>{enviando ? t("Publicando...") : t("Publicar")}</Text></Pressable>
        </View>
      </View>}

      {carregando || !filtro ? <ActivityIndicator color={c.primary} style={{ marginTop: 20 }} /> :
        posts.length === 0 ? <Text style={s.vazio}>{t(VAZIO[filtro])}</Text> :
        posts.map(p => {
          const textoBiblico = p.texto_biblico || textosBuscados[p.id];
          return <View key={p.id} style={s.card}>
            <View style={s.authorRow}><View style={s.avatar}><Text style={s.avatarText}>{p.autor_nome?.trim().charAt(0).toUpperCase()}</Text></View><View style={s.authorText}><Text style={s.author}>{p.autor_nome}</Text><Text style={s.scope}>{p.time_nome ? t("Time") + " " + p.time_nome : t(ALCANCES.find(a => a.valor === p.alcance)?.rotulo ?? "Toda a igreja")}</Text>{p.times_comuns?.length ? <Text style={s.comum} numberOfLines={1}>{t("Serve com você em") + " " + p.times_comuns.join(", ")}</Text> : null}</View></View>
            <Text style={s.ref}>{p.item_passagem || p.referencia_biblica}</Text>{textoBiblico ? <TrechoBiblico texto={textoBiblico} style={s.quote} corLink={c.primary} /> : null}<Text style={s.body}>{p.texto}</Text>
            {p.reacoes ? <View style={s.reacoes}>{REACOES.map(r => {
              const n = p.reacoes?.[r.tipo] ?? 0, minha = p.minhas?.includes(r.tipo) ?? false;
              return <Pressable key={r.tipo} onPress={() => reagir(p, r.tipo)} hitSlop={4} style={[s.reacao, minha && s.reacaoOn]} accessibilityRole="button" accessibilityState={{ selected: minha }} accessibilityLabel={t(r.rotulo) + (n ? `, ${n}` : "")}>
                <Text style={s.emoji}>{r.emoji}</Text>{n > 0 && <Text style={[s.reacaoN, minha && s.reacaoNOn]}>{n}</Text>}
              </Pressable>;
            })}</View> : null}
          </View>;
        })}
    </ScrollView>
  </SafeAreaView>;
}
const css = (c: any) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.background }, header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingVertical: 14 }, back: { width: 32, minHeight: 32, alignItems: "flex-start", justifyContent: "center" }, headerTitle: { flex: 1, color: c.text, fontSize: 18, fontWeight: "800", textAlign: "center" },
  content: { paddingHorizontal: 20, paddingBottom: 64, gap: 13 }, eyebrow: { color: c.primary, fontSize: 11, fontWeight: "800", letterSpacing: 1.5, marginTop: 8 }, title: { color: c.text, fontSize: 29, fontWeight: "800" },
  topo: { flexDirection: "row", alignItems: "flex-end", gap: 10 }, comentar: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: c.primary, borderRadius: 999, paddingHorizontal: 13, paddingVertical: 9, marginBottom: 3 }, comentarText: { color: "#fff", fontWeight: "800", fontSize: 13 },
  composer: { backgroundColor: c.surface, borderRadius: 18, padding: 15, gap: 11, borderWidth: 1, borderColor: c.border }, selectedVerse: { backgroundColor: c.background, padding: 13, borderRadius: 12, borderLeftWidth: 3, borderLeftColor: c.primary, gap: 6 },
  selectedHead: { flexDirection: "row", alignItems: "center", gap: 8 }, flex: { flex: 1 }, trocar: { color: c.primary, fontWeight: "800", fontSize: 13 },
  escolher: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: c.background, borderRadius: 13, padding: 14, borderWidth: 1, borderColor: c.border }, escolherTitulo: { color: c.text, fontWeight: "800" },
  input: { backgroundColor: c.background, color: c.text, borderRadius: 13, padding: 14, borderWidth: 1, borderColor: c.border }, area: { minHeight: 100, textAlignVertical: "top" }, label: { color: c.text, fontSize: 13, fontWeight: "800" },
  audiences: { flexDirection: "row", flexWrap: "wrap", gap: 7 }, audience: { flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 9, backgroundColor: c.background, borderWidth: 1, borderColor: c.border }, audienceOn: { backgroundColor: c.primary, borderColor: c.primary },
  audienceText: { color: c.textMuted, fontSize: 12, fontWeight: "700" }, audienceTextOn: { color: "#fff" },
  acoes: { flexDirection: "row", gap: 9 }, cancelar: { paddingHorizontal: 16, justifyContent: "center", borderRadius: 14, borderWidth: 1, borderColor: c.border }, cancelarText: { color: c.textMuted, fontWeight: "800" },
  cta: { backgroundColor: c.primary, padding: 15, borderRadius: 14, alignItems: "center" }, disabled: { opacity: .55 }, ctaText: { color: "#fff", fontSize: 16, fontWeight: "800" },
  time: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: c.border }, timeOn: { borderColor: c.primary, backgroundColor: c.primary + "22" },
  timeText: { color: c.textMuted, fontSize: 12, fontWeight: "700" }, timeTextOn: { color: c.primary }, comum: { color: c.primary, fontSize: 11, fontWeight: "700", marginTop: 1 },
  vazio: { color: c.textMuted, textAlign: "center", marginTop: 20, lineHeight: 21 },
  card: { backgroundColor: c.surface, padding: 16, borderRadius: 18, gap: 8, borderWidth: 1, borderColor: c.border },
  authorRow: { flexDirection: "row", alignItems: "center", gap: 10 }, avatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: c.primary, alignItems: "center", justifyContent: "center" }, avatarText: { color: "#fff", fontWeight: "800" }, authorText: { flex: 1 }, author: { color: c.text, fontWeight: "800" }, scope: { color: c.textMuted, fontSize: 11 }, ref: { color: c.primary, fontWeight: "800" }, quote: { color: c.text, lineHeight: 22, fontStyle: "italic" }, body: { color: c.text, lineHeight: 22 },
  reacoes: { flexDirection: "row", gap: 7, marginTop: 4 }, reacao: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: c.background, borderWidth: 1, borderColor: c.border },
  reacaoOn: { borderColor: c.primary, backgroundColor: c.primary + "22" }, emoji: { fontSize: 15 }, reacaoN: { color: c.textMuted, fontSize: 12, fontWeight: "800" }, reacaoNOn: { color: c.primary },
});
