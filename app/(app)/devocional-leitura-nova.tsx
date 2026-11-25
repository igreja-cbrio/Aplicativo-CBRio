import { ScrollView } from "@/components/navigation/DockContent";
import { Text, TextInput } from "@/components/ui/Typography";
import { useMemo, useState } from "react";
import { Alert, Pressable, Share, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useColors } from "@/contexts/ThemeContext";
import { useT } from "@/lib/i18n";
import { subirUmNivel } from "@/lib/hierarquia";
import { hojeBRT } from "@/lib/dataBRT";
import { mensagemDoErro } from "@/lib/erroMensagem";
import { LIVROS_BIBLIA } from "@/lib/bibliaLivre";
import { DIAS_MAX, dividirLeitura, referenciaDoDia, somarDias, textoConvite, versiculosDoCapitulo } from "@/lib/leituraGrupo";
import { criarLeitura } from "@/lib/leituraGrupoApi";

const SUGESTOES_DIAS = [7, 14, 21, 30];
const INICIOS = [{ rotulo: "Hoje", dias: 0 }, { rotulo: "Amanhã", dias: 1 }, { rotulo: "Segunda", dias: -1 }];

/** Próxima segunda-feira (BRT), a partir de hoje. */
function proximaSegunda(hoje: string): string {
  const [a, m, d] = hoje.split("-").map(Number);
  const dow = new Date(Date.UTC(a, m - 1, d)).getUTCDay();
  return somarDias(hoje, ((8 - dow) % 7) || 7);
}

export default function NovaLeitura() {
  const c = useColors(), s = useMemo(() => css(c), [c]), t = useT();
  const hoje = hojeBRT();
  const [livroOrdem, setLivroOrdem] = useState<number | null>(null);
  const [busca, setBusca] = useState("");
  const [capIni, setCapIni] = useState(1), [capFim, setCapFim] = useState(1);
  const [dias, setDias] = useState(7), [diasTxt, setDiasTxt] = useState("7");
  const [inicio, setInicio] = useState(0);
  const [titulo, setTitulo] = useState("");
  const [enviando, setEnviando] = useState(false);

  const livro = livroOrdem ? LIVROS_BIBLIA[livroOrdem - 1] : null;
  const versiculosTotal = useMemo(() => {
    if (!livroOrdem) return 0;
    let n = 0;
    for (let cap = capIni; cap <= capFim; cap++) n += versiculosDoCapitulo(livroOrdem, cap);
    return n;
  }, [livroOrdem, capIni, capFim]);
  const maxDias = Math.min(DIAS_MAX, versiculosTotal || DIAS_MAX);
  const dataInicio = INICIOS[inicio].dias === -1 ? proximaSegunda(hoje) : somarDias(hoje, INICIOS[inicio].dias);
  const divisao = useMemo(() => {
    if (!livroOrdem || dias < 1 || dias > maxDias) return null;
    try { return dividirLeitura(livroOrdem, capIni, capFim, dias); } catch { return null; }
  }, [livroOrdem, capIni, capFim, dias, maxDias]);

  const livrosFiltrados = useMemo(() => {
    const b = busca.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
    return LIVROS_BIBLIA.map((l, i) => ({ ...l, ordem: i + 1 }))
      .filter(l => !b || l.nome.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").includes(b));
  }, [busca]);

  function escolherLivro(ordem: number) {
    const l = LIVROS_BIBLIA[ordem - 1];
    setLivroOrdem(ordem); setCapIni(1); setCapFim(l.capitulos); setBusca("");
    const sugerido = Math.min(l.capitulos, DIAS_MAX);
    setDias(sugerido); setDiasTxt(String(sugerido));
  }
  function mudarDias(n: number) {
    const v = Math.max(1, Math.min(maxDias, Math.round(n) || 1));
    setDias(v); setDiasTxt(String(v));
  }
  function mudarCap(qual: "ini" | "fim", delta: number) {
    if (!livro) return;
    if (qual === "ini") setCapIni(v => Math.max(1, Math.min(capFim, v + delta)));
    else setCapFim(v => Math.max(capIni, Math.min(livro.capitulos, v + delta)));
  }

  async function criar() {
    if (!livroOrdem || !livro || !divisao) return Alert.alert(t("Falta pouco"), t("Escolha o livro e o número de dias."));
    const nome = titulo.trim() || `${t("Leitura de")} ${livro.nome}`;
    setEnviando(true);
    try {
      const r = await criarLeitura({ titulo: nome, livroOrdem, capInicio: capIni, capFim, dataInicio, divisao });
      router.replace({ pathname: "/devocional-leitura", params: { leituraId: r.id } });
      Share.share({ message: textoConvite({ titulo: nome, dias, dataInicio, codigo: r.codigo }) }).catch(() => undefined);
    } catch (e) {
      Alert.alert(t("Não foi possível criar"), mensagemDoErro(e));
    } finally { setEnviando(false); }
  }

  return <SafeAreaView style={s.safe} edges={["left", "right"]}><Stack.Screen options={{ headerShown: false }} />
    <View style={s.header}><Pressable onPress={() => subirUmNivel()} hitSlop={12} style={s.back} accessibilityRole="button" accessibilityLabel={t("Voltar")}><Ionicons name="chevron-back" size={24} color={c.text} /></Pressable><Text style={s.headerTitle}>{t("Nova leitura em grupo")}</Text><View style={s.back} /></View>
    <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
      <Text style={s.eyebrow}>{t("1 · O QUE LER")}</Text>
      {!livro ? <>
        <TextInput style={s.input} value={busca} onChangeText={setBusca} placeholder={t("Buscar livro")} placeholderTextColor={c.textMuted} />
        <View style={s.livros}>{livrosFiltrados.map(l => <Pressable key={l.ordem} onPress={() => escolherLivro(l.ordem)} style={({ pressed }) => [s.livro, pressed && s.pressed]}><Text style={s.livroTxt}>{l.nome}</Text></Pressable>)}</View>
      </> : <View style={s.card}>
        <View style={s.linha}><Text style={[s.cardTitle, s.flex]}>{livro.nome}</Text><Pressable onPress={() => setLivroOrdem(null)} hitSlop={8}><Text style={s.link}>{t("Trocar")}</Text></Pressable></View>
        {livro.capitulos > 1 && <View style={s.linha}>
          <Text style={[s.muted, s.flex]}>{t("Capítulos")}</Text>
          <Passo valor={capIni} menos={() => mudarCap("ini", -1)} mais={() => mudarCap("ini", 1)} s={s} c={c} />
          <Text style={s.muted}>{t("até")}</Text>
          <Passo valor={capFim} menos={() => mudarCap("fim", -1)} mais={() => mudarCap("fim", 1)} s={s} c={c} />
        </View>}
        <Text style={s.muted}>{capFim - capIni + 1} {capFim - capIni + 1 === 1 ? t("capítulo") : t("capítulos")} · {versiculosTotal} {t("versículos")}</Text>
      </View>}

      {livro && <>
        <Text style={s.eyebrow}>{t("2 · EM QUANTOS DIAS")}</Text>
        <View style={s.chips}>{SUGESTOES_DIAS.filter(d => d <= maxDias).map(d => <Pressable key={d} onPress={() => mudarDias(d)} style={[s.chip, dias === d && s.chipOn]}><Text style={[s.chipTxt, dias === d && s.chipTxtOn]}>{d} {t("dias")}</Text></Pressable>)}
          <TextInput style={[s.chip, s.chipInput]} value={diasTxt} onChangeText={v => { setDiasTxt(v.replace(/\D/g, "")); if (v) mudarDias(Number(v.replace(/\D/g, ""))); }} keyboardType="number-pad" maxLength={3} />
        </View>
        <Text style={s.eyebrow}>{t("3 · QUANDO COMEÇA")}</Text>
        <View style={s.chips}>{INICIOS.map((o, i) => <Pressable key={o.rotulo} onPress={() => setInicio(i)} style={[s.chip, inicio === i && s.chipOn]}><Text style={[s.chipTxt, inicio === i && s.chipTxtOn]}>{t(o.rotulo)}</Text></Pressable>)}</View>
        <Text style={s.muted}>{t("Começa em")} {dataInicio.split("-").reverse().join("/")} · {t("termina em")} {somarDias(dataInicio, dias - 1).split("-").reverse().join("/")}</Text>

        <Text style={s.eyebrow}>{t("4 · NOME")}</Text>
        <TextInput style={s.input} value={titulo} onChangeText={setTitulo} placeholder={`${t("Leitura de")} ${livro.nome}`} placeholderTextColor={c.textMuted} maxLength={80} />

        {divisao && <View style={s.card}>
          <Text style={s.cardTitle}>{t("Como fica por dia")}</Text>
          {divisao.slice(0, 5).map((d, i) => <View key={i} style={s.linha}><Text style={s.dia}>{t("Dia")} {i + 1}</Text><Text style={[s.muted, s.flex]}>{referenciaDoDia(livro.nome, livroOrdem!, d)}</Text></View>)}
          {divisao.length > 5 && <Text style={s.muted}>+ {divisao.length - 5} {t("dias")}</Text>}
        </View>}

        <Pressable style={[s.cta, (enviando || !divisao) && s.disabled]} onPress={criar} disabled={enviando || !divisao}><Ionicons name="paper-plane-outline" size={18} color="#fff" /><Text style={s.ctaTxt}>{enviando ? t("Criando...") : t("Criar e convidar")}</Text></Pressable>
        <Text style={[s.muted, s.centro]}>{t("Você recebe um link para mandar pelo WhatsApp para quem quiser.")}</Text>
      </>}
    </ScrollView>
  </SafeAreaView>;
}

function Passo({ valor, menos, mais, s, c }: { valor: number; menos: () => void; mais: () => void; s: any; c: any }) {
  return <View style={s.passo}>
    <Pressable onPress={menos} hitSlop={6} style={s.passoBtn}><Ionicons name="remove" size={16} color={c.text} /></Pressable>
    <Text style={s.passoTxt}>{valor}</Text>
    <Pressable onPress={mais} hitSlop={6} style={s.passoBtn}><Ionicons name="add" size={16} color={c.text} /></Pressable>
  </View>;
}

const css = (c: any) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.background }, header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingVertical: 14 }, back: { width: 32, minHeight: 32, justifyContent: "center" }, headerTitle: { flex: 1, textAlign: "center", color: c.text, fontSize: 18, fontWeight: "800" },
  content: { paddingHorizontal: 20, paddingBottom: 80, gap: 12 }, eyebrow: { color: c.primary, fontSize: 11, fontWeight: "800", letterSpacing: 1.4, marginTop: 10 },
  input: { backgroundColor: c.surface, color: c.text, borderRadius: 13, padding: 14, borderWidth: 1, borderColor: c.border },
  livros: { flexDirection: "row", flexWrap: "wrap", gap: 7 }, livro: { backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 }, livroTxt: { color: c.text, fontSize: 13, fontWeight: "700" }, pressed: { opacity: .7 },
  card: { backgroundColor: c.surface, borderRadius: 18, padding: 15, gap: 10, borderWidth: 1, borderColor: c.border }, cardTitle: { color: c.text, fontSize: 18, fontWeight: "800" },
  linha: { flexDirection: "row", alignItems: "center", gap: 8 }, flex: { flex: 1 }, link: { color: c.primary, fontWeight: "800" }, muted: { color: c.textMuted, fontSize: 13, lineHeight: 19 }, centro: { textAlign: "center" },
  passo: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: c.background, borderRadius: 999, paddingHorizontal: 6, paddingVertical: 4 }, passoBtn: { width: 26, height: 26, alignItems: "center", justifyContent: "center" }, passoTxt: { color: c.text, fontWeight: "800", minWidth: 24, textAlign: "center" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 7 }, chip: { borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border }, chipOn: { backgroundColor: c.primary, borderColor: c.primary },
  chipTxt: { color: c.text, fontWeight: "700", fontSize: 13 }, chipTxtOn: { color: "#fff" }, chipInput: { minWidth: 64, textAlign: "center", color: c.text, fontWeight: "800" },
  dia: { color: c.primary, fontWeight: "800", fontSize: 13, width: 52 },
  cta: { flexDirection: "row", gap: 8, backgroundColor: c.primary, padding: 15, borderRadius: 14, alignItems: "center", justifyContent: "center", marginTop: 8 }, disabled: { opacity: .55 }, ctaTxt: { color: "#fff", fontSize: 16, fontWeight: "800" },
});
