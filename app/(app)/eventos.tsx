import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Stack, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useColors } from "@/contexts/ThemeContext";
import { proximosEventos, formatEventoData, type EventoLista } from "@/lib/eventos";
import { font, radius, spacing, type Palette } from "@/constants/theme";

const MESES_LONG = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

export default function EventosScreen() {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const router = useRouter();

  const [eventos, setEventos] = useState<EventoLista[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    proximosEventos(80)
      .then(setEventos)
      .finally(() => setLoading(false));
  }, []);

  // Agrupa por (ano, mês) para mostrar separadores
  const grupos = useMemo(() => {
    const map = new Map<string, EventoLista[]>();
    for (const e of eventos) {
      const d = new Date(e.date + "T12:00:00");
      const chave = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (!map.has(chave)) map.set(chave, []);
      map.get(chave)!.push(e);
    }
    return [...map.entries()].map(([chave, lista]) => {
      const [y, m] = chave.split("-").map(Number);
      return { chave, titulo: `${MESES_LONG[m - 1]} de ${y}`, lista };
    });
  }, [eventos]);

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={styles.back}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.title}>Eventos</Text>
        <View style={{ width: 24 }} />
      </View>

      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} />
      ) : eventos.length === 0 ? (
        <View style={styles.vazio}>
          <Ionicons name="calendar-outline" size={48} color={colors.textMuted} />
          <Text style={styles.vazioTxt}>Nada agendado por enquanto.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {grupos.map((g) => (
            <View key={g.chave} style={{ gap: spacing.sm }}>
              <Text style={styles.mes}>{g.titulo}</Text>
              {g.lista.map((e) => {
                const dt = formatEventoData(e.date);
                return (
                  <View key={e.id} style={styles.card}>
                    <View style={styles.dataPill}>
                      <Text style={styles.dataDia}>{dt.dia}</Text>
                      <Text style={styles.dataMes}>{dt.mes}</Text>
                    </View>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={styles.nome}>{e.name}</Text>
                      <View style={styles.metaRow}>
                        {!!e.categoria && <Tag colors={colors} styles={styles} text={e.categoria} />}
                        {!!e.location && (
                          <View style={styles.metaLoc}>
                            <Ionicons name="location-outline" size={12} color={colors.textMuted} />
                            <Text style={styles.metaTxt} numberOfLines={1}>
                              {e.location}
                            </Text>
                          </View>
                        )}
                      </View>
                      {!!e.description && (
                        <Text style={styles.desc} numberOfLines={2}>
                          {primeiraLinha(e.description)}
                        </Text>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function primeiraLinha(s: string): string {
  return s.split("\n")[0].trim();
}

function Tag({
  text,
  styles,
}: {
  text: string;
  colors: Palette;
  styles: ReturnType<typeof makeStyles>;
}) {
  return (
    <View style={styles.tag}>
      <Text style={styles.tagTxt}>{text}</Text>
    </View>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      padding: spacing.lg,
      paddingBottom: spacing.md,
    },
    back: { width: 24 },
    title: { color: colors.text, fontSize: font.size.lg, fontWeight: "800" },
    content: { padding: spacing.lg, paddingTop: 0, paddingBottom: 140, gap: spacing.lg },
    mes: { color: colors.textMuted, fontSize: font.size.sm, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.6 },
    card: {
      flexDirection: "row",
      gap: spacing.md,
      padding: spacing.md,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.glassBorder,
      backgroundColor: colors.surface,
    },
    dataPill: {
      width: 52,
      height: 64,
      borderRadius: radius.md,
      backgroundColor: colors.glass,
      alignItems: "center",
      justifyContent: "center",
    },
    dataDia: { color: colors.text, fontSize: 22, fontWeight: "900", lineHeight: 24 },
    dataMes: { color: colors.brandMid, fontSize: 11, fontWeight: "700", textTransform: "uppercase" },
    nome: { color: colors.text, fontSize: font.size.md, fontWeight: "800" },
    metaRow: { flexDirection: "row", gap: spacing.xs, flexWrap: "wrap", alignItems: "center", marginTop: 2 },
    metaLoc: { flexDirection: "row", alignItems: "center", gap: 4 },
    metaTxt: { color: colors.textMuted, fontSize: 12 },
    desc: { color: colors.textMuted, fontSize: font.size.sm, marginTop: 2 },
    tag: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: radius.full,
      backgroundColor: colors.glass,
    },
    tagTxt: { color: colors.brandMid, fontSize: 11, fontWeight: "800" },
    vazio: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.md, padding: spacing.xl },
    vazioTxt: { color: colors.textMuted, fontSize: font.size.md, textAlign: "center" },
  });
