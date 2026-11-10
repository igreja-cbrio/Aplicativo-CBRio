// Área do Kids — hub do membro: minhas crianças (check-in), mural, eventos,
// horários e divisão das salas. Só exibição; o check-in vive em /kids.
import { ScrollView } from "@/components/navigation/DockContent";
import { Text } from "@/components/ui/Typography";
import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Image, Pressable, RefreshControl, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useColors } from "@/contexts/ThemeContext";
import { useT } from "@/lib/i18n";
import { subirUmNivel } from "@/lib/hierarquia";
import { apiGet } from "@/lib/api";
import { ErrorState } from "@/components/ui/ErrorState";
import { font, radius, spacing, type Palette } from "@/constants/theme";

type Mural = { id: string; titulo: string; corpo: string; destaque: boolean; publicado_em: string | null };
type Evento = { id: string; titulo: string; descricao: string | null; data: string | null; hora: string | null; local: string | null; destaque: boolean };
type Horario = { id: string; rotulo: string; descricao: string | null; ordem: number };
type Sala = { id: string; nome: string; faixa: string | null; cor: string | null; logo_url: string | null };
type KidsArea = { mural: Mural[]; eventos: Evento[]; horarios: Horario[]; salas: Sala[] };

const ROSA = "#E85D9A";

/** "2026-11-15" (dia civil, sem fuso) → "15/11/2026". Nunca passa por Date/UTC. */
function dataBR(d: string | null): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d || "");
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
}
/** "09:30:00" → "09:30". */
function horaCurta(h: string | null): string {
  const m = /^(\d{2}):(\d{2})/.exec(h || "");
  return m ? `${m[1]}:${m[2]}` : "";
}
function corValida(c: string | null): string {
  return c && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(c.trim()) ? c.trim() : ROSA;
}

export default function KidsAreaScreen() {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const t = useT();
  const [area, setArea] = useState<KidsArea | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [falhou, setFalhou] = useState(false);

  const carregar = useCallback(async () => {
    try {
      const r = await apiGet<KidsArea>("/app/kids/area");
      setArea({
        mural: r?.mural || [],
        eventos: r?.eventos || [],
        horarios: r?.horarios || [],
        salas: r?.salas || [],
      });
      setFalhou(false);
    } catch {
      setFalhou(true);
    } finally {
      setCarregando(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { carregar(); }, [carregar]));

  const secao = (titulo: string, icone: keyof typeof Ionicons.glyphMap, vazio: string, itens: React.ReactNode[]) => (
    <View style={styles.secao}>
      <View style={styles.secaoHead}>
        <Ionicons name={icone} size={18} color={ROSA} />
        <Text style={styles.secaoTitulo}>{titulo}</Text>
      </View>
      {itens.length === 0 ? <Text style={styles.vazio}>{vazio}</Text> : itens}
    </View>
  );

  return (
    <SafeAreaView style={styles.safe} edges={["left", "right"]}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); carregar(); }} tintColor={colors.brandMid} />}
      >
        <View style={styles.header}>
          <Pressable onPress={() => subirUmNivel("/kids-area")} hitSlop={8} style={styles.back} accessibilityRole="button" accessibilityLabel={t("Voltar")}>
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </Pressable>
          <Text style={styles.title}>{t("Área do Kids")}</Text>
          <View style={{ width: 24 }} />
        </View>

        <Pressable
          onPress={() => router.navigate("/kids")}
          style={({ pressed }) => [styles.destaqueCard, pressed && { opacity: 0.8 }]}
          accessibilityRole="button"
          accessibilityLabel={t("Minhas crianças")}
        >
          <View style={styles.destaqueIcone}><Ionicons name="happy-outline" size={26} color="#fff" /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.destaqueTitulo}>{t("Minhas crianças")}</Text>
            <Text style={styles.destaqueSub}>{t("Check-in, fichas e avisos dos seus filhos.")}</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#fff" />
        </Pressable>

        {carregando ? (
          <View style={styles.center}><ActivityIndicator color={colors.brandMid} /></View>
        ) : falhou && !area ? (
          <ErrorState onRetry={() => { setCarregando(true); carregar(); }} />
        ) : area ? (
          <>
            {secao(t("Mural de avisos"), "megaphone-outline", t("Nenhum aviso por enquanto."),
              area.mural.map((m) => (
                <View key={m.id} style={[styles.card, m.destaque && styles.cardDestaque]}>
                  {m.destaque ? <Text style={styles.selo}>{t("Destaque")}</Text> : null}
                  <Text style={styles.cardTitulo}>{m.titulo}</Text>
                  <Text style={styles.cardCorpo}>{m.corpo}</Text>
                </View>
              )))}

            {secao(t("Fique por dentro"), "calendar-outline", t("Nenhum evento previsto por enquanto."),
              area.eventos.map((e) => {
                const quando = [dataBR(e.data), horaCurta(e.hora)].filter(Boolean).join(" · ");
                return (
                  <View key={e.id} style={[styles.card, e.destaque && styles.cardDestaque]}>
                    {e.destaque ? <Text style={styles.selo}>{t("Destaque")}</Text> : null}
                    <Text style={styles.cardTitulo}>{e.titulo}</Text>
                    {quando ? <Text style={styles.meta}>{quando}</Text> : null}
                    {e.local ? <Text style={styles.meta}>{e.local}</Text> : null}
                    {e.descricao ? <Text style={styles.cardCorpo}>{e.descricao}</Text> : null}
                  </View>
                );
              }))}

            {secao(t("Horários de funcionamento"), "time-outline", t("Os horários serão divulgados em breve."),
              [...area.horarios].sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0)).map((h) => (
                <View key={h.id} style={styles.card}>
                  <Text style={styles.cardTitulo}>{h.rotulo}</Text>
                  {h.descricao ? <Text style={styles.cardCorpo}>{h.descricao}</Text> : null}
                </View>
              )))}

            {secao(t("Divisão das salas"), "grid-outline", t("A divisão das salas será divulgada em breve."),
              area.salas.map((s) => (
                <View key={s.id} style={[styles.card, styles.salaRow]}>
                  {s.logo_url ? (
                    <Image source={{ uri: s.logo_url }} style={styles.salaLogo} resizeMode="contain" />
                  ) : null}
                  <View style={[styles.bolinha, { backgroundColor: corValida(s.cor) }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitulo}>{s.nome}</Text>
                    {s.faixa ? <Text style={styles.meta}>{s.faixa}</Text> : null}
                  </View>
                </View>
              )))}
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    content: { padding: spacing.lg, paddingBottom: 40, gap: spacing.lg },
    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    back: { width: 24 },
    title: { color: colors.text, fontSize: font.size.lg, fontWeight: "800" },
    center: { alignItems: "center", paddingVertical: spacing.xl },
    destaqueCard: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: ROSA, borderRadius: radius.lg, padding: spacing.lg },
    destaqueIcone: { width: 46, height: 46, borderRadius: 23, backgroundColor: "rgba(255,255,255,0.25)", alignItems: "center", justifyContent: "center" },
    destaqueTitulo: { color: "#fff", fontSize: font.size.lg, fontWeight: "800" },
    destaqueSub: { color: "#fff", fontSize: font.size.sm, marginTop: 2 },
    secao: { gap: spacing.sm },
    secaoHead: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
    secaoTitulo: { color: colors.text, fontSize: font.size.md, fontWeight: "800" },
    vazio: { color: colors.textMuted, fontSize: font.size.md, paddingVertical: spacing.sm },
    card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.glassBorder, borderRadius: radius.lg, padding: spacing.lg, gap: 4 },
    cardDestaque: { borderColor: ROSA, borderWidth: 2 },
    selo: { color: ROSA, fontSize: font.size.sm, fontWeight: "800" },
    cardTitulo: { color: colors.text, fontSize: font.size.md, fontWeight: "800" },
    cardCorpo: { color: colors.textMuted, fontSize: font.size.md, lineHeight: 22, marginTop: 2 },
    meta: { color: colors.brandMid, fontSize: font.size.sm, fontWeight: "700" },
    salaRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
    salaLogo: { width: 40, height: 40, borderRadius: 8 },
    bolinha: { width: 14, height: 14, borderRadius: 7 },
  });
