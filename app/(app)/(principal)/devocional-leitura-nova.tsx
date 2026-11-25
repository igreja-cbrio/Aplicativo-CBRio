import { ScrollView } from "@/components/navigation/DockContent";
import { Text, TextInput } from "@/components/ui/Typography";
import { useMemo, useState } from "react";
import { Alert, Pressable, Share, StyleSheet, Switch, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useColors } from "@/contexts/ThemeContext";
import { useT } from "@/lib/i18n";
import { subirUmNivel } from "@/lib/hierarquia";
import { hojeBRT } from "@/lib/dataBRT";
import { mensagemDoErro } from "@/lib/erroMensagem";
import { LIVROS_BIBLIA } from "@/lib/bibliaLivre";
import {
  LIVROS_MAX, datasDosDias, maxDias, montarDivisao, referenciaDoDia, resumoDosLivros, somarDias, textoConvite,
  totalCapitulos, type LivroEscolhido,
} from "@/lib/leituraGrupo";
import { criarLeitura } from "@/lib/leituraGrupoApi";

const SUGESTOES_DIAS = [7, 14, 21, 30];
const INICIOS = [{ rotulo: "Hoje", dias: 0 }, { rotulo: "Amanhã", dias: 1 }, { rotulo: "Segunda", dias: -1 }];
const dataBR = (iso: string) => iso.split("-").reverse().join("/");

/** Próxima segunda-feira (BRT), a partir de hoje. */
function proximaSegunda(hoje: string): string {
  const [a, m, d] = hoje.split("-").map(Number);
  const dow = new Date(Date.UTC(a, m - 1, d)).getUTCDay();
  return somarDias(hoje, ((8 - dow) % 7) || 7);
}
const semAcento = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/**
 * Criar leitura em grupo (v2 · 25/11/2026): um ou mais livros, na ordem escolhida;
 * capítulos sempre inteiros (dias de 1 ao total de capítulos); opção de incluir
 * sábado e domingo. As datas só dizem quando cada dia libera (não é prazo).
 */
export default function NovaLeitura() {
  const c = useColors(), s = useMemo(() => css(c), [c]), t = useT();
  const hoje = hojeBRT();
  const [livros, setLivros] = useState<LivroEscolhido[]>([]);
  const [escolhendo, setEscolhendo] = useState(true), [busca, setBusca] = useState("");
  const [dias, setDias] = useState(1), [diasTxt, setDiasTxt] = useState("1");
  const [fimDeSemana, setFimDeSemana] = useState(true);
  const [inicio, setInicio] = useState(0);
  const [titulo, setTitulo] = useState("");
  const [enviando, setEnviando] = useState(false);

  const total = totalCapitulos(livros), maximo = maxDias(livros);
  const dataBase = INICIOS[inicio].dias === -1 ? proximaSegunda(hoje) : somarDias(hoje, INICIOS[inicio].dias);
  const divisao = useMemo(() => {
    if (!livros.length || dias < 1 || dias > maximo) return null;
    try { return montarDivisao(livros, dias, dataBase, fimDeSemana); } catch { return null; }
  }, [livros, dias, maximo, dataBase, fimDeSemana]);
  const datas = useMemo(() => (dias >= 1 ? datasDosDias(dataBase, dias, fimDeSemana) : []), [dataBase, dias, fimDeSemana]);

  const livrosFiltrados = useMemo(() => {
    const b = semAcento(busca.trim());
    return LIVROS_BIBLIA.map((l, i) => ({ ...l, ordem: i + 1 })).filter(l => !b || semAcento(l.nome).includes(b));
  }, [busca]);

  function ajustarDias(novoMax: number, sugerido?: number) {
    const v = Math.max(1, Math.min(novoMax || 1, sugerido ?? dias));
    setDias(v); setDiasTxt(String(v));
  }
  function adicionarLivro(ordem: number) {
    const l = LIVROS_BIBLIA[ordem - 1];
    const novos = [...livros, { livro: ordem, cap_inicio: 1, cap_fim: l.capitulos }];
    setLivros(novos); setEscolhendo(false); setBusca("");
    // Sugestão: um capítulo por dia, limitado a 30 (a pessoa ajusta).
    ajustarDias(maxDias(novos), Math.min(maxDias(novos), 30));
  }
  function removerLivro(i: number) {
    const novos = livros.filter((_, k) => k !== i);
    setLivros(novos); if (!novos.length) setEscolhendo(true);
    ajustarDias(maxDias(novos));
  }
  function mudarCap(i: number, qual: "ini" | "fim", delta: number) {
    const capMax = LIVROS_BIBLIA[livros[i].livro - 1].capitulos;
    const novos = livros.map((l, k) => k !== i ? l : qual === "ini"
      ? { ...l, cap_inicio: Math.max(1, Math.min(l.cap_fim, l.cap_inicio + delta)) }
      : { ...l, cap_fim: Math.max(l.cap_inicio, Math.min(capMax, l.cap_fim + delta)) });
    setLivros(novos); ajustarDias(maxDias(novos));
  }
  function mudarDias(n: number) { ajustarDias(maximo, Math.round(n) || 1); }

  async function criar() {
    if (!livros.length || !divisao) return Alert.alert(t("Falta pouco"), t("Escolha o livro e o número de dias."));
    const nome = titulo.trim() || `${t("Leitura de")} ${resumoDosLivros(livros)}`.slice(0, 80);
    const dataInicio = divisao[0].data ?? dataBase;
    setEnviando(true);
    try {
      const r = await criarLeitura({ titulo: nome, livros, dataInicio, fimDeSemana, divisao });
      router.replace({ pathname: "/devocional-leitura", params: { leituraId: r.id } });
      Share.share({ message: textoConvite({ titulo: nome, dias, dataInicio, codigo: r.codigo, fimDeSemana }) }).catch(() => undefined);
    } catch (e) {
      Alert.alert(t("Não foi possível criar"), mensagemDoErro(e));
    } finally { setEnviando(false); }
  }

  const porDia = dias ? total / dias : 0;
  const ritmo = porDia <= 1 ? t("1 capítulo por dia") : Number.isInteger(porDia) ? `${porDia} ${t("capítulos por dia")}` : `${Math.floor(porDia)} ${t("a")} ${Math.ceil(porDia)} ${t("capítulos por dia")}`;

  return <SafeAreaView style={s.safe} edges={["left", "right"]}><Stack.Screen options={{ headerShown: false }} />
    <View style={s.header}><Pressable onPress={() => subirUmNivel()} hitSlop={12} style={s.back} accessibilityRole="button" accessibilityLabel={t("Voltar")}><Ionicons name="chevron-back" size={24} color={c.text} /></Pressable><Text style={s.headerTitle}>{t("Nova leitura em grupo")}</Text><View style={s.back} /></View>
    <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
      <Text style={s.eyebrow}>{t("1 · O QUE LER")}</Text>
      {livros.map((l, i) => {
        const info = LIVROS_BIBLIA[l.livro - 1];
        return <View key={`${l.livro}-${i}`} style={s.card}>
          <View style={s.linha}><Text style={[s.cardTitle, s.flex]}>{info.nome}</Text><Pressable onPress={() => removerLivro(i)} hitSlop={8} accessibilityLabel={t("Remover")}><Ionicons name="close-circle-outline" size={22} color={c.textMuted} /></Pressable></View>
          {info.capitulos > 1 && <View style={s.linha}>
            <Text style={[s.muted, s.flex]}>{t("Capítulos")}</Text>
            <Passo valor={l.cap_inicio} menos={() => mudarCap(i, "ini", -1)} mais={() => mudarCap(i, "ini", 1)} s={s} c={c} />
            <Text style={s.muted}>{t("até")}</Text>
            <Passo valor={l.cap_fim} menos={() => mudarCap(i, "fim", -1)} mais={() => mudarCap(i, "fim", 1)} s={s} c={c} />
          </View>}
        </View>;
      })}
      {escolhendo ? <>
        <TextInput style={s.input} value={busca} onChangeText={setBusca} placeholder={t("Buscar livro")} placeholderTextColor={c.textMuted} />
        <View style={s.livros}>{livrosFiltrados.map(l => <Pressable key={l.ordem} onPress={() => adicionarLivro(l.ordem)} style={({ pressed }) => [s.livro, pressed && s.pressed]}><Text style={s.livroTxt}>{l.nome}</Text></Pressable>)}</View>
      </> : livros.length < LIVROS_MAX && <Pressable onPress={() => setEscolhendo(true)} style={({ pressed }) => [s.adicionar, pressed && s.pressed]}><Ionicons name="add" size={18} color={c.primary} /><Text style={s.link}>{t("Adicionar outro livro")}</Text></Pressable>}

      {livros.length > 0 && <>
        <Text style={s.eyebrow}>{t("2 · EM QUANTOS DIAS")}</Text>
        <View style={s.aviso}><Ionicons name="information-circle-outline" size={18} color={c.primary} />
          <Text style={[s.muted, s.flex]}>{total} {total === 1 ? t("capítulo") : t("capítulos")} · {t("de 1 a")} {maximo} {maximo === 1 ? t("dia") : t("dias")}. {t("Cada dia tem pelo menos um capítulo inteiro; para mais dias, adicione outro livro.")}</Text></View>
        <View style={s.chips}>{SUGESTOES_DIAS.filter(d => d <= maximo).map(d => <Pressable key={d} onPress={() => mudarDias(d)} style={[s.chip, dias === d && s.chipOn]}><Text style={[s.chipTxt, dias === d && s.chipTxtOn]}>{d} {t("dias")}</Text></Pressable>)}
          {!SUGESTOES_DIAS.includes(maximo) && <Pressable onPress={() => mudarDias(maximo)} style={[s.chip, dias === maximo && s.chipOn]}><Text style={[s.chipTxt, dias === maximo && s.chipTxtOn]}>{maximo} {maximo === 1 ? t("dia") : t("dias")}</Text></Pressable>}
          <TextInput style={[s.chip, s.chipInput]} value={diasTxt} onChangeText={v => { const n = v.replace(/\D/g, ""); setDiasTxt(n); if (n) mudarDias(Number(n)); }} onBlur={() => setDiasTxt(String(dias))} keyboardType="number-pad" maxLength={3} />
        </View>
        <Text style={s.ritmo}>{ritmo}</Text>

        <Text style={s.eyebrow}>{t("3 · QUANDO COMEÇA")}</Text>
        <View style={s.chips}>{INICIOS.map((o, i) => <Pressable key={o.rotulo} onPress={() => setInicio(i)} style={[s.chip, inicio === i && s.chipOn]}><Text style={[s.chipTxt, inicio === i && s.chipTxtOn]}>{t(o.rotulo)}</Text></Pressable>)}</View>
        <View style={[s.card, s.linha]}>
          <View style={s.flex}><Text style={s.cardSub}>{t("Incluir sábado e domingo")}</Text><Text style={s.muted}>{fimDeSemana ? t("Um dia de leitura por dia do calendário.") : t("As leituras caem de segunda a sexta.")}</Text></View>
          <Switch value={fimDeSemana} onValueChange={setFimDeSemana} trackColor={{ true: c.primary }} />
        </View>
        {datas.length > 0 && <Text style={s.muted}>{t("O dia 1 libera em")} {dataBR(datas[0])}{datas.length > 1 ? ` · ${t("o último, em")} ${dataBR(datas[datas.length - 1])}` : ""}. {t("Cada um lê no seu ritmo: dia liberado fica disponível enquanto a leitura existir.")}</Text>}

        <Text style={s.eyebrow}>{t("4 · NOME")}</Text>
        <TextInput style={s.input} value={titulo} onChangeText={setTitulo} placeholder={`${t("Leitura de")} ${resumoDosLivros(livros)}`.slice(0, 80)} placeholderTextColor={c.textMuted} maxLength={80} />

        {divisao && <View style={s.card}>
          <Text style={s.cardTitle}>{t("Como fica por dia")}</Text>
          {divisao.slice(0, 5).map((d, i) => <View key={i} style={s.linha}><Text style={s.dia}>{t("Dia")} {i + 1}</Text><Text style={[s.muted, s.flex]}>{referenciaDoDia(d, livros[0].livro)}</Text></View>)}
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
  card: { backgroundColor: c.surface, borderRadius: 18, padding: 15, gap: 10, borderWidth: 1, borderColor: c.border }, cardTitle: { color: c.text, fontSize: 18, fontWeight: "800" }, cardSub: { color: c.text, fontSize: 15, fontWeight: "800" },
  adicionar: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, padding: 12, borderRadius: 14, borderWidth: 1, borderStyle: "dashed", borderColor: c.primary },
  aviso: { flexDirection: "row", gap: 8, alignItems: "flex-start", backgroundColor: c.surface, borderRadius: 14, padding: 12, borderWidth: 1, borderColor: c.border },
  linha: { flexDirection: "row", alignItems: "center", gap: 8 }, flex: { flex: 1 }, link: { color: c.primary, fontWeight: "800" }, muted: { color: c.textMuted, fontSize: 13, lineHeight: 19 }, centro: { textAlign: "center" },
  ritmo: { color: c.primary, fontWeight: "800", fontSize: 13 },
  passo: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: c.background, borderRadius: 999, paddingHorizontal: 6, paddingVertical: 4 }, passoBtn: { width: 26, height: 26, alignItems: "center", justifyContent: "center" }, passoTxt: { color: c.text, fontWeight: "800", minWidth: 24, textAlign: "center" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 7 }, chip: { borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border }, chipOn: { backgroundColor: c.primary, borderColor: c.primary },
  chipTxt: { color: c.text, fontWeight: "700", fontSize: 13 }, chipTxtOn: { color: "#fff" }, chipInput: { minWidth: 64, textAlign: "center", color: c.text, fontWeight: "800" },
  dia: { color: c.primary, fontWeight: "800", fontSize: 13, width: 52 },
  cta: { flexDirection: "row", gap: 8, backgroundColor: c.primary, padding: 15, borderRadius: 14, alignItems: "center", justifyContent: "center", marginTop: 8 }, disabled: { opacity: .55 }, ctaTxt: { color: "#fff", fontSize: 16, fontWeight: "800" },
});
