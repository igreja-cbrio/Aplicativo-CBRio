import { useState } from "react";
import { Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "@/components/ui/Typography";
import { useColors } from "@/contexts/ThemeContext";
import { useKidsTheme } from "@/contexts/KidsThemeContext";
import { useT } from "@/lib/i18n";
import { hojeBRT } from "@/lib/dataBRT";
import { diasDoMesKids, moverMesKids } from "@/lib/kidsCalendario";
import { dataBR, type Evento } from "@/lib/kidsArea";

export function CalendarioEventosKids({ eventos, dia, escolher }: { eventos: Evento[]; dia: string | null; escolher: (dia: string | null) => void }) {
  const [mes, setMes] = useState(hojeBRT().slice(0, 7));
  const colors = useColors();
  const { tema } = useKidsTheme();
  const t = useT();
  const marcados = new Set(eventos.map(e => e.data?.slice(0, 10)));
  const nomes = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
  return <View style={{ padding: 12, borderRadius: 20, backgroundColor: colors.surface, gap: 12 }}>
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
      <Pressable onPress={() => { escolher(null); setMes(moverMesKids(mes, -1)); }} accessibilityRole="button" accessibilityLabel={t("Mês anterior")} style={{ padding: 12 }}><Ionicons name="chevron-back" size={22} color={colors.text} /></Pressable>
      <Text style={{ color: colors.text, fontWeight: "700" }}>{t(nomes[Number(mes.slice(5)) - 1])} {mes.slice(0, 4)}</Text>
      <Pressable onPress={() => { escolher(null); setMes(moverMesKids(mes, 1)); }} accessibilityRole="button" accessibilityLabel={t("Próximo mês")} style={{ padding: 12 }}><Ionicons name="chevron-forward" size={22} color={colors.text} /></Pressable>
    </View>
    <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
      {["D", "S", "T", "Q", "Q", "S", "S"].map((nome, i) => <Text key={`s${i}`} style={{ width: "14.285%", textAlign: "center", color: colors.textMuted, paddingBottom: 8 }}>{nome}</Text>)}
      {diasDoMesKids(mes).map((data, i) => data ? <Pressable key={data} accessibilityRole="button" accessibilityState={{ selected: dia === data }} accessibilityLabel={`${dataBR(data)}${marcados.has(data) ? `, ${t("Com eventos")}` : ""}`} onPress={() => escolher(dia === data ? null : data)} style={{ width: "14.285%", minHeight: 48, alignItems: "center", justifyContent: "center", gap: 3, backgroundColor: dia === data ? tema.fundo : "transparent", borderRadius: 12 }}>
        <Text style={{ color: dia === data ? "#253D44" : colors.text }}>{Number(data.slice(-2))}</Text>
        <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: marcados.has(data) ? (dia === data ? "#253D44" : tema.fundo) : "transparent" }} />
      </Pressable> : <View key={i} style={{ width: "14.285%" }} />)}
    </View>
    <Pressable onPress={() => escolher(null)} accessibilityRole="button" style={{ padding: 10 }}><Text style={{ color: colors.text, textAlign: "center" }}>{t("Ver todos os eventos")}</Text></Pressable>
  </View>;
}
