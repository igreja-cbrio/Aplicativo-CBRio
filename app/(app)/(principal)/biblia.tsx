import { useContext } from "react";
import { DockInsetContext } from "@/components/navigation/DockContent";
import { Modal, ScrollView } from "@/components/navigation/DockContent";
import { Text, TextInput } from "@/components/ui/Typography";
import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Stack, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useColors, useTheme } from "@/contexts/ThemeContext";
import { carregarCapitulo, LIVROS_BIBLIA, VERSOES_BIBLIA, type LivroBiblico, type VersaoBiblica, type VersiculoLivre } from "@/lib/bibliaLivre";
import { listarMarcacoesBiblia, registrarLeituraBiblia, removerMarcacoesBiblia, salvarRegistroPessoal, ultimaLeituraBiblia } from "@/lib/devocional";
import { subirUmNivel } from "@/lib/hierarquia";
import { useMembro } from "@/lib/useMembro";
import { useT } from "@/lib/i18n";
import { useFonteLeitura } from "@/lib/useFonteLeitura";
import { escalar } from "@/lib/fonteLeitura";
import { FONTE_SERIF } from "@/lib/fonteSerif";
import { ControleFonte } from "@/components/devocional/ControleFonte";
import { chegouAoFim } from "@/lib/fimDeLeitura";

const CORES = [{ nome: "amarelo" as const, cor: "#F8E59A" }, { nome: "azul" as const, cor: "#BFDDEA" }, { nome: "verde" as const, cor: "#CDE2C2" }, { nome: "rosa" as const, cor: "#EAC6D2" }];
export default function Biblia() {
  const dockInset = useContext(DockInsetContext);
  // Bíblia SEM casca (27/11/2026 · lib/appNavigation ROTAS_DE_LEITURA): sem a faixa de cima
  // e sem a barra de baixo, quem respeita o notch e o gesto do sistema é esta tela.
  // `dockInset` continua valendo se um dia a casca voltar.
  const insets = useSafeAreaInsets(), { mode } = useTheme();
  const rodape = dockInset > 0 ? dockInset : Math.max(insets.bottom, 8);
  const colors = useColors(), styles = useMemo(() => css(colors), [colors]), t = useT(), { membro } = useMembro();
  // A−/A+ da leitura (24/09/2026): compartilhado com o devocional, persistido no aparelho.
  const fonte = useFonteLeitura();
  const tamVerso = escalar({ fontSize: 19, lineHeight: 32 }, fonte.passo);
  const [livro, setLivro] = useState<LivroBiblico | null>(null), [capitulo, setCapitulo] = useState<number | null>(null);
  const [versiculos, setVersiculos] = useState<VersiculoLivre[]>([]), [selecionados, setSelecionados] = useState<number[]>([]);
  const [busca, setBusca] = useState(""), [carregando, setCarregando] = useState(false);
  const [versao, setVersao] = useState<VersaoBiblica>(VERSOES_BIBLIA[0]), [versoesAbertas, setVersoesAbertas] = useState(false);
  const [marcacoes, setMarcacoes] = useState<Record<number, string>>({});
  const scrollRef = useRef<ScrollView>(null);
  // Investir (25/11/2026): o capítulo conta quando a pessoa chega ao FIM dele.
  // Uma vez por capítulo aberto; as medidas vêm da própria rolagem.
  const contado = useRef<string | null>(null), alturaVisivel = useRef(0), alturaConteudo = useRef(0);
  // Última leitura (25/11/2026): a Bíblia abria direto no último capítulo e escondia
  // Minhas anotações e Meu histórico. Agora abre na lista, com um atalho para continuar.
  const [ultima, setUltima] = useState<{ livro: LivroBiblico; numero: number } | null>(null);
  const buscouUltima = useRef(false);
  const normalizar = (v: string) => v.normalize("NFD").replace(/[\\u0300-\\u036f]/g, "").toLowerCase();
  const livrosFiltrados = LIVROS_BIBLIA.filter(l => normalizar(l.nome).includes(normalizar(busca)));
  useEffect(() => {
    if (!membro?.membroId || buscouUltima.current) return;
    buscouUltima.current = true;
    ultimaLeituraBiblia(membro.membroId).then(ultima => {
      if (!ultima) return;
      const separador = ultima.lastIndexOf(" "), nome = ultima.slice(0, separador), numero = Number(ultima.slice(separador + 1));
      const encontrado = LIVROS_BIBLIA.find(l => l.nome === nome);
      if (encontrado && numero) setUltima({ livro: encontrado, numero });
    }).catch(() => undefined);
  }, [membro?.membroId]);

  function voltar() {
    if (selecionados.length) { setSelecionados([]); return; }
    if (capitulo) { setCapitulo(null); setVersiculos([]); return; }
    if (livro) { setLivro(null); return; }
    subirUmNivel();
  }
  async function abrirCapitulo(numero: number, livroAlvo = livro, versaoAlvo = versao) {
    if (!livroAlvo) return;
    setCarregando(true);
    try {
      const prefixo = livroAlvo.nome + " " + numero;
      const [versos, salvas] = await Promise.all([
        carregarCapitulo(livroAlvo, numero, versaoAlvo.id),
        membro?.membroId ? listarMarcacoesBiblia(membro.membroId, prefixo) : Promise.resolve([]),
      ]);
      const mapa: Record<number, string> = {};
      salvas.forEach(m => m.referencia_biblica.slice(prefixo.length + 1).split(",").forEach(v => {
        const n = Number(v); if (n && !mapa[n]) mapa[n] = m.cor;
      }));
      setMarcacoes(mapa);
      setLivro(livroAlvo); setVersiculos(versos); setCapitulo(numero); setSelecionados([]); setUltima({ livro: livroAlvo, numero });
      scrollRef.current?.scrollTo({ y: 0, animated: false });
      contado.current = null; alturaConteudo.current = 0;
    } catch { Alert.alert(t("Erro"), t("Não foi possível carregar este capítulo. Confira a internet e tente de novo, ou escolha outra versão.")); }
    finally { setCarregando(false); }
  }
  async function trocarVersao(nova: VersaoBiblica) {
    setVersao(nova); setVersoesAbertas(false);
    if (capitulo) await abrirCapitulo(capitulo, livro, nova);
  }
  function conferirFim(rolagem: number) {
    if (!livro || !capitulo || !versiculos.length || !membro?.membroId) return;
    const chave = livro.nome + " " + capitulo;
    if (contado.current === chave) return;
    if (!chegouAoFim({ rolagem, alturaVisivel: alturaVisivel.current, alturaConteudo: alturaConteudo.current, folgaFinal: rodape + 220 })) return;
    contado.current = chave;
    registrarLeituraBiblia(membro.membroId, chave).catch(() => { contado.current = null; });
  }
  function alternar(numero: number) { setSelecionados(v => v.includes(numero) ? v.filter(x => x !== numero) : [...v, numero].sort((a, b) => a - b)); }
  const textoSelecionado = versiculos.filter(v => selecionados.includes(v.verse)).map(v => v.text.trim()).join(" ");
  const referencia = livro && capitulo && selecionados.length ? livro.nome + " " + capitulo + ":" + selecionados.join(",") : "";
  function comentar(privado: boolean) {
    const pathname = privado ? "/devocional-registros" : "/devocional-mural";
    router.navigate({ pathname, params: { referencia, textoBiblico: textoSelecionado, origem: "biblia" } } as any);
  }
  async function marcar(cor: typeof CORES[number]["nome"]) {
    if (!membro?.membroId || !livro || !capitulo) return;
    const membroId = membro.membroId;
    try {
      await Promise.all(versiculos.filter(v => selecionados.includes(v.verse)).map(v => salvarRegistroPessoal({
        membroId, origem: "biblia", referencia: livro.nome + " " + capitulo + ":" + v.verse,
        textoBiblico: v.text.trim(), cor,
      })));
      setMarcacoes(atuais => { const proximas = { ...atuais }; selecionados.forEach(v => { proximas[v] = cor; }); return proximas; });
      setSelecionados([]);
      Alert.alert(t("Marcação salva"), t("Você encontra esse texto em Minhas anotações."));
    }
    catch (e) { Alert.alert(t("Não foi possível salvar"), e instanceof Error ? e.message : t("Tente novamente.")); }
  }
  async function removerMarcacao() {
    if (!membro?.membroId || !livro || !capitulo) return;
    try {
      const removidas = await removerMarcacoesBiblia(membro.membroId, livro.nome + " " + capitulo, selecionados);
      setMarcacoes(atuais => { const proximas = { ...atuais }; removidas.forEach(v => { delete proximas[v]; }); return proximas; });
      setSelecionados([]);
      Alert.alert(t("Marcação removida"));
    } catch (e) { Alert.alert(t("Não foi possível remover"), e instanceof Error ? e.message : t("Tente novamente.")); }
  }
  const temMarcacaoSelecionada = selecionados.some(v => Boolean(marcacoes[v]));
  const titulo = capitulo ? livro?.nome + " " + capitulo : livro?.nome ?? t("Bíblia");
  return <SafeAreaView style={[styles.safe, Boolean(capitulo) && styles.readerSafe]} edges={["left", "right"]}><Stack.Screen options={{ headerShown: false }} />
    <StatusBar style={capitulo || mode !== "dark" ? "dark" : "light"} />
    <View style={[styles.header, Boolean(capitulo) && styles.readerHeader, { paddingTop: insets.top + 14 }]}>
      <Pressable onPress={voltar} hitSlop={12} style={styles.back}><Ionicons name="chevron-back" size={24} color={capitulo ? "#263234" : colors.text} /></Pressable>
      {capitulo ? <View style={styles.readerNav}>
        <Pressable style={styles.locationButton} onPress={() => { setCapitulo(null); setVersiculos([]); setSelecionados([]); }}><Text style={styles.locationText} numberOfLines={1}>{livro?.nome} {capitulo}</Text><Ionicons name="chevron-down" size={15} color="#263234" /></Pressable>
        <Pressable style={styles.versionButton} onPress={() => setVersoesAbertas(true)}><Text style={styles.versionText}>{versao.sigla}</Text><Ionicons name="chevron-down" size={14} color="#263234" /></Pressable>
      </View> : <Text style={styles.headerTitle} numberOfLines={1}>{titulo}</Text>}
      {capitulo ? <ControleFonte passo={fonte.passo} mudar={fonte.mudar} papel /> : <View style={styles.back} />}
    </View>
    <ScrollView ref={scrollRef}
      onLayout={e => { alturaVisivel.current = e.nativeEvent.layout.height; }}
      onContentSizeChange={(_, h) => { alturaConteudo.current = h; conferirFim(0); }}
      onScroll={e => conferirFim(e.nativeEvent.contentOffset.y)} scrollEventThrottle={250}
      contentContainerStyle={[styles.content, Boolean(capitulo) && [styles.readerContent, { paddingBottom: rodape + 220 }]]} showsVerticalScrollIndicator={!capitulo}>
      {!livro && <BookList busca={busca} setBusca={setBusca} livros={livrosFiltrados} abrir={setLivro} ultima={ultima} continuar={() => ultima && abrirCapitulo(ultima.numero, ultima.livro)} s={styles} c={colors} t={t} />}
      {livro && !capitulo && <><Text style={styles.eyebrow}>{t("CAPÍTULOS")}</Text><Text style={styles.title}>{livro.nome}</Text><View style={styles.chapters}>{Array.from({ length: livro.capitulos }, (_, i) => <Pressable key={i + 1} style={styles.chapter} onPress={() => abrirCapitulo(i + 1)}><Text style={styles.chapterText}>{i + 1}</Text></Pressable>)}</View></>}
      {carregando && <ActivityIndicator color={colors.primary} size="large" />}
      {capitulo && !carregando && <View style={styles.reading}><Text style={styles.chapterNumber}>{capitulo}</Text>{versiculos.map(v => {
        const ativo = selecionados.includes(v.verse);
        const marcada = CORES.find(x => x.nome === marcacoes[v.verse])?.cor;
        return <Pressable key={v.verse} onPress={() => alternar(v.verse)} style={[styles.verse, marcada ? { backgroundColor: marcada } : undefined, ativo && styles.verseSelected]}><Text style={[styles.verseText, { fontSize: tamVerso.fontSize, lineHeight: tamVerso.lineHeight }]}><Text style={[styles.verseNumber, ativo && styles.verseNumberSelected]}>{v.verse} </Text>{v.text.trim()}</Text></Pressable>;
      })}<Text style={styles.translation}>{versao.nome} · {versao.licenca === "domínio público" ? t("domínio público") : versao.licenca}</Text></View>}
    </ScrollView>
    {selecionados.length > 0 && <View style={[styles.actions, { bottom: rodape + 78 }]}>
      {temMarcacaoSelecionada
        ? <Pressable style={styles.removeMark} onPress={removerMarcacao}><Ionicons name="close-circle-outline" size={20} color="#A44343" /><Text style={styles.removeMarkText}>{t("Remover marcação")}</Text></Pressable>
        : <View style={styles.colors}>{CORES.map(x => <Pressable key={x.nome} onPress={() => marcar(x.nome)} style={[styles.color, { backgroundColor: x.cor }]} accessibilityLabel={t("Marcar versículo")} />)}</View>}
      <View style={styles.actionRule} /><Pressable style={styles.action} onPress={() => comentar(true)}><Ionicons name="bookmark-outline" size={20} color="#263234" /><Text style={styles.actionText}>{t("Salvar")}</Text></Pressable><Pressable style={styles.action} onPress={() => comentar(false)}><Ionicons name="chatbubble-outline" size={20} color="#263234" /><Text style={styles.actionText}>{t("Comentários")}</Text></Pressable>
    </View>}
    {capitulo && <View style={[styles.chapterNav, { bottom: rodape + 12 }]}>
      <Pressable disabled={carregando || capitulo <= 1} onPress={() => abrirCapitulo(capitulo - 1)} style={[styles.chapterArrow, capitulo <= 1 && styles.chapterArrowDisabled]}><Ionicons name="chevron-back" size={22} color="#263234" /><Text style={styles.chapterArrowText}>{t("Anterior")}</Text></Pressable>
      <Text style={styles.chapterPosition} numberOfLines={1}>{livro?.nome} {capitulo}</Text>
      <Pressable disabled={carregando || capitulo >= (livro?.capitulos ?? 0)} onPress={() => abrirCapitulo(capitulo + 1)} style={[styles.chapterArrow, capitulo >= (livro?.capitulos ?? 0) && styles.chapterArrowDisabled]}><Text style={styles.chapterArrowText}>{t("Próximo")}</Text><Ionicons name="chevron-forward" size={22} color="#263234" /></Pressable>
    </View>}
    <Modal visible={versoesAbertas} transparent animationType="fade" onRequestClose={() => setVersoesAbertas(false)}>
      <Pressable style={styles.modalBackdrop} onPress={() => setVersoesAbertas(false)}><Pressable style={styles.versionSheet} onPress={() => undefined}>
        <View style={styles.sheetHandle} /><Text style={styles.sheetTitle}>{t("Versão da Bíblia")}</Text>
        {VERSOES_BIBLIA.map(v => <Pressable key={v.id} onPress={() => trocarVersao(v)} style={styles.versionOption}><View style={styles.versionBadge}><Text style={styles.versionBadgeText}>{v.sigla}</Text></View><View style={styles.versionInfo}><Text style={styles.versionName}>{v.nome}</Text><Text style={styles.versionLanguage}>{v.idioma} · {v.licenca === "domínio público" ? t("domínio público") : v.licenca}</Text></View>{versao.id === v.id && <Ionicons name="checkmark-circle" size={23} color={colors.primary} />}</Pressable>)}
      </Pressable></Pressable>
    </Modal>
  </SafeAreaView>;
}
function BookList({ busca, setBusca, livros, abrir, ultima, continuar, s, c, t }: any) {
  const secao = (titulo: string, xs: LivroBiblico[]) => xs.length ? <><Text style={s.testament}>{t(titulo)}</Text>{xs.map(item => <Pressable key={item.api} style={s.book} onPress={() => abrir(item)}><Text style={s.bookText}>{item.nome}</Text><Ionicons name="chevron-forward" size={17} color={c.textMuted} /></Pressable>)}</> : null;
  const antigo = livros.filter((l: LivroBiblico) => LIVROS_BIBLIA.indexOf(l) < 39), novo = livros.filter((l: LivroBiblico) => LIVROS_BIBLIA.indexOf(l) >= 39);
  // Minhas anotações e Meu histórico moraram na home do Devocional até 25/11/2026;
  // o Marcos pediu os dois aqui, no topo da escolha de livro (home enxuta, sem rolar).
  return <><View style={s.atalhos}>
    <Pressable style={({ pressed }) => [s.atalho, pressed && { opacity: .7 }]} onPress={() => router.navigate("/devocional-registros")} accessibilityRole="button"><Ionicons name="bookmark-outline" size={20} color={c.primary} /><View style={{ flexShrink: 1 }}><Text style={s.atalhoTitulo}>{t("Minhas anotações")}</Text><Text style={s.atalhoLegenda} numberOfLines={1}>{t("Notas e marcações")}</Text></View></Pressable>
    <Pressable style={({ pressed }) => [s.atalho, pressed && { opacity: .7 }]} onPress={() => router.navigate("/devocional-leituras")} accessibilityRole="button"><Ionicons name="stats-chart-outline" size={20} color={c.primary} /><View style={{ flexShrink: 1 }}><Text style={s.atalhoTitulo}>{t("Meu histórico")}</Text><Text style={s.atalhoLegenda} numberOfLines={1}>{t("Dias e planos lidos")}</Text></View></Pressable>
  </View>{ultima && <Pressable style={({ pressed }) => [s.atalho, s.continuar, pressed && { opacity: .7 }]} onPress={continuar} accessibilityRole="button"><Ionicons name="book-outline" size={20} color={c.primary} /><View style={{ flex: 1 }}><Text style={s.atalhoTitulo}>{t("Continuar onde parei")}</Text><Text style={s.atalhoLegenda} numberOfLines={1}>{ultima.livro.nome} {ultima.numero}</Text></View><Ionicons name="chevron-forward" size={17} color={c.textMuted} /></Pressable>}<Text style={s.eyebrow}>{t("ALMEIDA LIVRE")}</Text><Text style={s.title}>{t("Escolha um livro")}</Text><View style={s.search}><Ionicons name="search" size={19} color={c.textMuted} /><TextInput value={busca} onChangeText={setBusca} style={s.searchInput} placeholder={t("Pesquisar livro")} placeholderTextColor={c.textMuted} autoCorrect={false} /></View>{secao("Antigo Testamento", antigo)}{secao("Novo Testamento", novo)}</>;
}
const css = (c: any) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.background }, readerSafe: { backgroundColor: "#FBFAF7" }, header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingVertical: 14 }, readerHeader: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#DDD8CE" }, back: { width: 32, minHeight: 32, justifyContent: "center" }, headerTitle: { flex: 1, color: c.text, fontSize: 18, fontWeight: "800", textAlign: "center" },
  readerNav: { flex: 1, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 7 }, locationButton: { flexShrink: 1, flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10, backgroundColor: "#EFEDE7" }, locationText: { flexShrink: 1, color: "#263234", fontSize: 14, fontWeight: "800" }, versionButton: { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 9, paddingVertical: 8, borderRadius: 10, backgroundColor: "#E2EBEC" }, versionText: { color: "#263234", fontSize: 12, fontWeight: "900" },
  content: { paddingHorizontal: 20, paddingBottom: 64, gap: 9 }, readerContent: { paddingHorizontal: 25, paddingBottom: 220 }, eyebrow: { color: c.primary, fontSize: 11, fontWeight: "800", letterSpacing: 1.5, marginTop: 8 }, title: { color: c.text, fontSize: 29, fontWeight: "900" },
  search: { flexDirection: "row", alignItems: "center", gap: 9, backgroundColor: c.surface, borderRadius: 14, paddingHorizontal: 13, marginVertical: 7, borderWidth: 1, borderColor: c.border }, searchInput: { flex: 1, color: c.text, height: 48, fontSize: 15 },
  atalhos: { flexDirection: "row", gap: 10, marginTop: 6 }, atalho: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: c.surface, borderRadius: 16, padding: 13, borderWidth: 1, borderColor: c.border },
  continuar: { flex: 0 }, atalhoTitulo: { color: c.text, fontSize: 14, fontWeight: "800" }, atalhoLegenda: { color: c.textMuted, fontSize: 11, marginTop: 2 },
  testament: { color: c.text, fontSize: 18, fontWeight: "900", marginTop: 18, marginBottom: 3 }, book: { paddingVertical: 13, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border }, bookText: { color: c.text, fontSize: 16, fontWeight: "600" },
  chapters: { flexDirection: "row", flexWrap: "wrap", gap: 9, marginTop: 8 }, chapter: { width: 48, height: 48, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: c.surface, borderWidth: 1, borderColor: c.border }, chapterText: { color: c.text, fontSize: 15, fontWeight: "700" },
  reading: { paddingTop: 9 }, chapterNumber: { color: "#2D3B3D", fontFamily: FONTE_SERIF, fontSize: 58, lineHeight: 66, marginBottom: 7 }, verse: { borderRadius: 8, paddingHorizontal: 4, paddingVertical: 3, marginHorizontal: -4 }, verseSelected: { backgroundColor: "#DDECF1" },
  verseText: { color: "#252827", fontFamily: FONTE_SERIF, fontSize: 19, lineHeight: 32 }, verseNumber: { color: "#738083", fontFamily: "Gotham-Bold", fontSize: 10 }, verseNumberSelected: { color: c.primary }, translation: { color: "#8B8A84", fontSize: 11, textAlign: "center", marginTop: 28 },
  actions: { position: "absolute", left: 12, right: 12, bottom: 78, minHeight: 74, borderRadius: 20, backgroundColor: "#fff", flexDirection: "row", alignItems: "center", paddingHorizontal: 13, gap: 10, shadowColor: "#000", shadowOpacity: .15, shadowRadius: 14, shadowOffset: { width: 0, height: 5 }, elevation: 9, borderWidth: 1, borderColor: "#E1DED7" },
  colors: { flexDirection: "row", gap: 7 }, color: { width: 24, height: 24, borderRadius: 12, borderWidth: 1, borderColor: "rgba(0,0,0,.12)" }, removeMark: { width: 96, alignItems: "center", justifyContent: "center", gap: 3 }, removeMarkText: { color: "#A44343", fontSize: 9, lineHeight: 11, fontWeight: "800", textAlign: "center" }, actionRule: { width: StyleSheet.hairlineWidth, height: 38, backgroundColor: "#DDD8CE" }, action: { alignItems: "center", justifyContent: "center", gap: 3, flex: 1 }, actionText: { color: "#263234", fontSize: 10, fontWeight: "800" },
  chapterNav: { position: "absolute", left: 12, right: 12, bottom: 12, height: 54, borderRadius: 17, backgroundColor: "#F1EFEA", flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 10, borderWidth: 1, borderColor: "#DDD8CE" }, chapterArrow: { flexDirection: "row", alignItems: "center", minWidth: 82, minHeight: 42 }, chapterArrowDisabled: { opacity: .25 }, chapterArrowText: { color: "#263234", fontSize: 11, fontWeight: "800" }, chapterPosition: { flex: 1, textAlign: "center", color: "#667173", fontSize: 11, fontWeight: "700" },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(10,18,19,.48)", justifyContent: "flex-end" }, versionSheet: { backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 10, paddingBottom: 34 }, sheetHandle: { width: 42, height: 4, borderRadius: 2, backgroundColor: "#D4D2CC", alignSelf: "center", marginBottom: 15 }, sheetTitle: { color: "#263234", fontSize: 21, fontWeight: "900", marginBottom: 10 }, versionOption: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 13, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#E4E1DA" }, versionBadge: { width: 45, height: 38, borderRadius: 10, backgroundColor: "#E2EBEC", alignItems: "center", justifyContent: "center" }, versionBadgeText: { color: "#263234", fontWeight: "900", fontSize: 11 }, versionInfo: { flex: 1 }, versionName: { color: "#263234", fontSize: 15, fontWeight: "800" }, versionLanguage: { color: "#758083", fontSize: 11, marginTop: 3 },
});
