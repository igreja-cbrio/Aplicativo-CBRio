import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, router, useLocalSearchParams, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useColors } from "@/contexts/ThemeContext";
import { useT } from "@/lib/i18n";
import { apiGet } from "@/lib/api";
import { font, radius, spacing, type Palette } from "@/constants/theme";

type Checkin = {
  id: string;
  checkin_at: string;
  checkout_at: string | null;
  decisao: boolean;
  sala: string | null;
  cor: string | null;
  culto: string | null;
  data: string | null;
};
type Detalhe = {
  crianca: {
    id: string; nome: string; idade_meses: number | null;
    observacoes_medicas: string | null; necessidades_especiais: string | null;
    parentesco: string | null; foto_url: string | null;
  };
  sala_sugerida: { nome: string; cor: string } | null;
  total_checkins: number;
  historico: Checkin[];
};

function idadeLabel(meses: number | null): string {
  if (meses == null) return "";
  if (meses < 24) return `${meses} ${meses === 1 ? "mês" : "meses"}`;
  return `${Math.floor(meses / 12)} anos`;
}

export default function KidsFilhoScreen() {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const t = useT();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [d, setD] = useState<Detalhe | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    if (!id) return;
    try {
      setD(await apiGet<Detalhe>(`/app/kids/filho/${id}`));
      setErro(null);
    } catch (e) {
      setErro(e instanceof Error ? e.message : t("Não foi possível carregar."));
    }
  }, [id, t]);

  useFocusEffect(useCallback(() => { carregar(); }, [carregar]));

  const c = d?.crianca;

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace("/kids"))} hitSlop={8} style={styles.back} accessibilityRole="button" accessibilityLabel={t("Voltar")}>
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </Pressable>
          <Text style={styles.title} numberOfLines={1}>{c?.nome || t("Criança")}</Text>
          <View style={{ width: 24 }} />
        </View>

        {!d && !erro ? (
          <View style={styles.center}><ActivityIndicator color={colors.brandMid} /></View>
        ) : erro ? (
          <View style={styles.center}><Text style={styles.vazio}>{erro}</Text></View>
        ) : c ? (
          <>
            <View style={styles.topo}>
              {c.foto_url ? (
                <Image source={{ uri: c.foto_url }} style={styles.foto} />
              ) : (
                <View style={[styles.foto, styles.fotoVazia]}><Ionicons name="happy-outline" size={36} color={colors.brandMid} /></View>
              )}
              <Text style={styles.nome}>{c.nome}</Text>
              <Text style={styles.idade}>{idadeLabel(c.idade_meses)}</Text>
              {d?.sala_sugerida && (
                <View style={[styles.salaPill, { backgroundColor: (d.sala_sugerida.cor || colors.brandMid) + "22" }]}>
                  <View style={[styles.salaDot, { backgroundColor: d.sala_sugerida.cor || colors.brandMid }]} />
                  <Text style={styles.salaTxt}>{t("Sala")}: {d.sala_sugerida.nome}</Text>
                </View>
              )}
            </View>

            {(c.observacoes_medicas || c.necessidades_especiais) && (
              <View style={styles.alerta}>
                <Ionicons name="medkit-outline" size={18} color="#B45309" />
                <View style={{ flex: 1 }}>
                  {c.observacoes_medicas ? <Text style={styles.alertaTxt}>{c.observacoes_medicas}</Text> : null}
                  {c.necessidades_especiais ? <Text style={styles.alertaTxt}>{c.necessidades_especiais}</Text> : null}
                </View>
              </View>
            )}

            <View style={styles.histHeader}>
              <Text style={styles.histTitulo}>{t("Histórico de presença")}</Text>
              {d ? <Text style={styles.histTotal}>{d.total_checkins}</Text> : null}
            </View>

            {d && d.historico.length === 0 ? (
              <Text style={styles.vazio}>{t("Nenhum check-in ainda.")}</Text>
            ) : (
              d?.historico.map((k) => (
                <View key={k.id} style={styles.item}>
                  <View style={[styles.itemDot, { backgroundColor: k.cor || colors.brandMid }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemTitulo}>{k.culto || t("Culto")}</Text>
                    <Text style={styles.itemSub}>
                      {k.data ? new Date(k.data + "T00:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" }) : ""}
                      {k.sala ? ` · ${k.sala}` : ""}
                    </Text>
                  </View>
                  {k.decisao ? <Ionicons name="heart" size={16} color="#E11D48" /> : null}
                  {k.checkout_at ? <Ionicons name="checkmark-done" size={18} color="#3FA66B" /> : <Ionicons name="time-outline" size={18} color={colors.textMuted} />}
                </View>
              ))
            )}
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    content: { padding: spacing.lg, paddingBottom: 40, gap: spacing.md },
    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.xs },
    back: { width: 24 },
    title: { color: colors.text, fontSize: font.size.lg, fontWeight: "800", flex: 1, textAlign: "center" },
    center: { alignItems: "center", paddingVertical: spacing.xl },
    vazio: { color: colors.textMuted, fontSize: font.size.md, textAlign: "center", paddingVertical: spacing.md },
    topo: { alignItems: "center", gap: 4 },
    foto: { width: 96, height: 96, borderRadius: 48, backgroundColor: colors.surface },
    fotoVazia: { alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.glassBorder },
    nome: { color: colors.text, fontSize: font.size.xl, fontWeight: "800", marginTop: spacing.xs },
    idade: { color: colors.textMuted, fontSize: font.size.md },
    salaPill: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 5, borderRadius: radius.full, marginTop: spacing.xs },
    salaDot: { width: 8, height: 8, borderRadius: 4 },
    salaTxt: { color: colors.text, fontSize: font.size.sm, fontWeight: "700" },
    alerta: { flexDirection: "row", gap: spacing.sm, backgroundColor: "rgba(245,158,11,0.12)", borderWidth: 1, borderColor: "rgba(245,158,11,0.3)", borderRadius: radius.md, padding: spacing.md },
    alertaTxt: { color: "#92400E", fontSize: font.size.sm, lineHeight: 19 },
    histHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: spacing.sm },
    histTitulo: { color: colors.text, fontSize: font.size.md, fontWeight: "700" },
    histTotal: { color: colors.brandMid, fontSize: font.size.md, fontWeight: "800" },
    item: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.glassBorder, borderRadius: radius.md, padding: spacing.md },
    itemDot: { width: 10, height: 10, borderRadius: 5 },
    itemTitulo: { color: colors.text, fontSize: font.size.md, fontWeight: "600" },
    itemSub: { color: colors.textMuted, fontSize: font.size.sm, marginTop: 1 },
  });
