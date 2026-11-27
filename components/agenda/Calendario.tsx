import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "@/components/ui/Typography";
import { useColors } from "@/contexts/ThemeContext";
import { useLang, useT } from "@/lib/i18n";
import { agendaDoMes } from "@/lib/agendaApi";
import { hojeBRT } from "@/lib/dataBRT";
import { diasDoMes, eventosDoDia, formatarDataAgenda, mudarMes, type AgendaItem } from "@/lib/agendaCalendario";
import { type Palette } from "@/constants/theme";

export function Calendario({ revisao = 0 }: { revisao?: number }) {
  const colors = useColors();
  const s = useMemo(() => estilos(colors), [colors]);
  const t = useT();
  const { lang } = useLang();
  const [mes, setMes] = useState(() => hojeBRT().slice(0, 7));
  const [dia, setDia] = useState<string | null>(null);
  const [itens, setItens] = useState<AgendaItem[]>([]);
  const [erro, setErro] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [tentativa, setTentativa] = useState(0);
  useFocusEffect(useCallback(() => {
    let ativo = true;
    setCarregando(true); setErro(false); setItens([]);
    agendaDoMes(mes)
      .then(r => { if (ativo) setItens(r.itens); })
      .catch(() => { if (ativo) setErro(true); })
      .finally(() => { if (ativo) setCarregando(false); });
    return () => { ativo = false; };
  }, [mes, revisao, tentativa]));
  function trocar(delta: number) { setDia(null); setMes(m => mudarMes(m, delta)); }
  const dias = diasDoMes(mes);
  const eventos = eventosDoDia(itens, dia);
  const titulo = new Intl.DateTimeFormat(lang, { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${mes}-01T12:00:00Z`));
  const semana = Array.from({ length: 7 }, (_, n) => new Intl.DateTimeFormat(lang, { weekday: "short", timeZone: "UTC" }).format(new Date(Date.UTC(2026, 0, 4 + n))));
  return <View style={s.wrap}>
    <View style={s.calendar}>
      <View style={s.monthRow}>
        <Pressable accessibilityRole="button" accessibilityLabel={t("Mês anterior")} disabled={mes === "2000-01"} style={s.nav} onPress={() => trocar(-1)}><Ionicons name="chevron-back" size={22} color={colors.text} /></Pressable>
        <Text accessibilityRole="header" style={s.month}>{titulo}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel={t("Próximo mês")} disabled={mes === "2099-12"} style={s.nav} onPress={() => trocar(1)}><Ionicons name="chevron-forward" size={22} color={colors.text} /></Pressable>
      </View>
      <View style={s.week}>{semana.map((d, i) => <Text key={i} style={s.weekday}>{d}</Text>)}</View>
      {Array.from({ length: dias.length / 7 }, (_, n) => <View key={n} style={s.week}>{dias.slice(n * 7, n * 7 + 7).map((data, i) => data ? <Pressable key={data} style={[s.day, data === hojeBRT() && s.today, data === dia && s.selected]} onPress={() => setDia(atual => atual === data ? null : data)} accessibilityRole="button" accessibilityState={{ selected: data === dia }} accessibilityLabel={`${formatarDataAgenda(data, lang)}${eventosDoDia(itens, data).length ? `, ${t("Com eventos")}` : ""}`}>
        <Text style={[s.dayText, data === dia && { color: "#fff" }]}>{Number(data.slice(8))}</Text><View style={[s.dot, { backgroundColor: eventosDoDia(itens, data).length ? data === dia ? "#fff" : colors.brandMid : "transparent" }]} />
      </Pressable> : <View key={`v${i}`} style={s.day} />)}</View>)}
      <Pressable accessibilityRole="button" style={s.all} onPress={() => { setDia(null); setMes(hojeBRT().slice(0, 7)); }}><Text style={s.link}>{t("Voltar ao mês atual")}</Text></Pressable>
    </View>
    {carregando ? <ActivityIndicator color={colors.brandMid} accessibilityLabel={t("Carregando agenda…")} /> : erro ? <View style={s.card}><Text style={s.body}>{t("Não foi possível carregar a agenda.")}</Text><Pressable style={s.all} accessibilityRole="button" onPress={() => setTentativa(n => n + 1)}><Text style={s.link}>{t("Tentar novamente")}</Text></Pressable></View> : <>
      <View style={s.headingRow}><Text accessibilityRole="header" style={s.heading}>{dia ? formatarDataAgenda(dia, lang) : t("Eventos do mês")}</Text>{dia && <Pressable style={s.all} accessibilityRole="button" onPress={() => setDia(null)}><Text style={s.link}>{t("Ver mês inteiro")}</Text></Pressable>}</View>
      {!eventos.length && <Text style={s.body}>{dia ? t("Nenhum evento cadastrado para este dia.") : t("Nenhum evento cadastrado para este mês.")}</Text>}
      {eventos.map(item => <View key={item.id} style={s.card}>
        <Text style={s.date}>{formatarDataAgenda(item.inicio, lang)}{item.fim !== item.inicio ? ` – ${formatarDataAgenda(item.fim, lang)}` : ""}{item.hora ? ` · ${item.hora}` : ""}</Text>
        <Text style={s.itemTitle}>{item.titulo}</Text>
        {!!item.local && <Text style={s.body}>{item.local}</Text>}
        {!!item.descricao && <Text style={s.body}>{item.descricao}</Text>}
      </View>)}
      {eventos.some(i => i.hora) && <Text style={s.note}>{t("Horários de Brasília")}</Text>}
    </>}
  </View>;
}
const estilos = (c: Palette) => StyleSheet.create({
  wrap: { gap: 16 }, calendar: { backgroundColor: c.glass, borderColor: c.glassBorder, borderWidth: 1, borderRadius: 24, padding: 10 },
  monthRow: { flexDirection: "row", alignItems: "center", marginBottom: 12 }, month: { flex: 1, textAlign: "center", textTransform: "capitalize", color: c.text, fontSize: 18, fontWeight: "700" }, nav: { padding: 12, minHeight: 44 },
  week: { flexDirection: "row" }, weekday: { flex: 1, textAlign: "center", color: c.textMuted, fontSize: 11, paddingBottom: 10 },
  day: { flex: 1, minHeight: 46, alignItems: "center", justifyContent: "center", borderRadius: 12, borderWidth: 1, borderColor: "transparent" }, today: { borderColor: c.brandMid }, selected: { backgroundColor: c.primaryDark }, dayText: { fontSize: 15, color: c.text }, dot: { height: 4, width: 4, borderRadius: 2, marginTop: 3 },
  all: { minHeight: 44, paddingHorizontal: 6, justifyContent: "center", alignItems: "center" }, link: { color: c.brandMid, fontSize: 13, fontWeight: "700" }, headingRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", justifyContent: "space-between" }, heading: { color: c.text, fontSize: 19, fontWeight: "700" },
  card: { backgroundColor: c.glass, borderColor: c.glassBorder, borderWidth: 1, borderRadius: 20, padding: 18, gap: 8 }, date: { color: c.brandMid, fontSize: 13, fontWeight: "700" }, itemTitle: { color: c.text, fontSize: 17, fontWeight: "700" }, body: { color: c.textMuted, fontSize: 14, lineHeight: 21 }, note: { color: c.textMuted, fontSize: 12 },
});
