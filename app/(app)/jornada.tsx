import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useColors } from "@/contexts/ThemeContext";
import { useMembro } from "@/lib/useMembro";
import { carregarJornada, type Jornada } from "@/lib/jornada";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { useT } from "@/lib/i18n";
import { font, radius, spacing, type Palette } from "@/constants/theme";
import { FEATURES } from "@/lib/features";

function brl(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

const NODE = 40;
const NODE_MT = 4;
const RAIL_W = 44;

type Passo = {
  key: string;
  valor: string; // rótulo do valor (eyebrow)
  titulo: string;
  status: string;
  on: boolean;
  rota: "/devocional" | "/grupos" | "/voluntariado" | "/batismo" | "/generosidade";
  icon: React.ComponentProps<typeof Ionicons>["name"];
};

export default function JornadaScreen() {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const t = useT();
  const { membro } = useMembro();
  const [dados, setDados] = useState<Jornada | null>(null);
  const [estado, setEstado] = useState<"loading" | "pronto" | "erro">("loading");

  const carregar = useCallback(() => {
    if (!membro?.membroId) { setEstado("pronto"); return; }
    setEstado("loading");
    carregarJornada(membro.membroId)
      .then((d) => { setDados(d); setEstado("pronto"); })
      .catch(() => setEstado("erro"));
  }, [membro?.membroId]);

  useFocusEffect(carregar);

  const nome = membro?.nome?.split(/\s+/)[0] ?? "";

  // Trilha na ordem da jornada CBRio: Seguir → Conectar → Investir → Servir → Generosidade.
  const trilha = useMemo(() => {
    if (!dados) return null;
    const streak = dados.devocionalStreak;
    const passos: Passo[] = [
      {
        key: "seguir", valor: "Seguir a Jesus", titulo: "Batismo",
        status: dados.batizado ? "Batizado(a) ✓" : "Dê seu próximo passo",
        on: dados.batizado, rota: "/batismo", icon: "water",
      },
      {
        key: "conectar", valor: "Conectar", titulo: "Grupo de conexão",
        status: dados.emGrupo ? "Em um grupo 💙" : "Encontre um grupo perto de você",
        on: dados.emGrupo, rota: "/grupos", icon: "people",
      },
      {
        key: "investir", valor: "Investir", titulo: "Devocional",
        status: streak > 0
          ? `🔥 ${streak} ${streak === 1 ? "dia seguido" : "dias seguidos"} · ${dados.devocionalTotal} leituras`
          : `Comece hoje · ${dados.devocionalTotal} leituras no total`,
        on: streak > 0, rota: "/devocional", icon: "book",
      },
      {
        key: "servir", valor: "Servir", titulo: "Voluntariado",
        status: dados.serveVoluntariado ? "Servindo 💙" : "Comece a servir num ministério",
        on: dados.serveVoluntariado, rota: "/voluntariado", icon: "hand-left",
      },
      ...(FEATURES.generosidade
        ? [{
            key: "generosidade", valor: "Generosidade", titulo: "Generosidade",
            status: dados.generosidadeAno > 0 ? `${brl(dados.generosidadeAno)} no ano` : "Participe da generosidade",
            on: dados.generosidadeAno > 0, rota: "/generosidade" as const, icon: "gift" as const,
          } satisfies Passo]
        : []),
    ];
    const score = passos.filter((p) => p.on).length;
    const proximoIdx = passos.findIndex((p) => !p.on);
    return { passos, score, total: passos.length, proximoIdx };
  }, [dados]);

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={8} style={styles.back} accessibilityRole="button" accessibilityLabel={t("Voltar")}>
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </Pressable>
          <Text style={styles.title}>{t("Sua jornada")}</Text>
          <View style={{ width: 24 }} />
        </View>

        {estado === "loading" ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} />
        ) : estado === "erro" ? (
          <ErrorState onRetry={carregar} />
        ) : !membro?.membroId ? (
          <EmptyState
            icon="person-outline"
            titulo={t("Complete seu cadastro")}
            texto={t("Vincule seu CPF no perfil pra acompanhar sua jornada na CBRio.")}
            acao={{ label: t("Ir para o perfil"), onPress: () => router.navigate("/perfil") }}
          />
        ) : dados && trilha ? (
          <>
            <Text style={styles.intro}>
              {nome ? `${t("Sua caminhada na CBRio")}, ${nome} 💙` : t("Sua caminhada na CBRio 💙")}
            </Text>

            {/* Progresso geral da trilha */}
            <View style={styles.progressCard}>
              <View style={styles.progressTop}>
                <Text style={styles.progressTxt}>
                  <Text style={styles.progressNum}>{trilha.score}</Text> {t("de")} {trilha.total} {t("valores")}
                </Text>
                <Text style={styles.progressPct}>{Math.round((trilha.score / trilha.total) * 100)}%</Text>
              </View>
              <View style={styles.progressBar}>
                <View style={[styles.progressFill, { width: `${(trilha.score / trilha.total) * 100}%` }]} />
              </View>
            </View>

            {/* Trilha (track) */}
            <View style={styles.track}>
              {trilha.passos.map((p, i) => {
                const prevDone = i > 0 && trilha.passos[i - 1].on;
                const isNext = i === trilha.proximoIdx;
                const primeiro = i === 0;
                const ultimo = i === trilha.passos.length - 1;
                return (
                  <View key={p.key} style={styles.row}>
                    {/* Rail com linha + nó */}
                    <View style={styles.rail}>
                      {!primeiro && <View style={[styles.lineTop, prevDone && styles.lineOn]} />}
                      {!ultimo && <View style={[styles.lineBottom, p.on && styles.lineOn]} />}
                      <View style={[styles.node, p.on && styles.nodeDone, isNext && !p.on && styles.nodeNext]}>
                        {p.on ? (
                          <Ionicons name="checkmark" size={22} color="#fff" />
                        ) : (
                          <Ionicons name={p.icon} size={20} color={isNext ? colors.primary : colors.textMuted} />
                        )}
                      </View>
                    </View>

                    {/* Cartão do passo */}
                    <Pressable
                      style={({ pressed }) => [
                        styles.stepCard,
                        isNext && styles.stepCardNext,
                        p.on && styles.stepCardDone,
                        pressed && styles.pressed,
                      ]}
                      onPress={() => router.navigate(p.rota)}
                      accessibilityRole="button"
                      accessibilityLabel={`${t(p.titulo)}. ${t(p.status)}`}
                    >
                      <View style={{ flex: 1 }}>
                        <View style={styles.stepEyebrowRow}>
                          <Text style={[styles.stepEyebrow, isNext && { color: colors.brandMid }]}>
                            {t(p.valor).toUpperCase()}
                          </Text>
                          {isNext && (
                            <View style={styles.badgeNext}>
                              <Text style={styles.badgeNextTxt}>{t("PRÓXIMO PASSO")}</Text>
                            </View>
                          )}
                        </View>
                        <Text style={styles.stepTitulo}>{t(p.titulo)}</Text>
                        <Text style={[styles.stepStatus, p.on && { color: colors.text }]}>{t(p.status)}</Text>
                      </View>
                      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                    </Pressable>
                  </View>
                );
              })}
            </View>

            <Text style={styles.rodape}>{t("Cada passo conta. Continue crescendo na fé. 🌱")}</Text>
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
    title: { color: colors.text, fontSize: font.size.lg, fontWeight: "800" },
    intro: { color: colors.textMuted, fontSize: font.size.md },
    // progresso
    progressCard: {
      backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
      borderRadius: radius.lg, padding: spacing.md, gap: spacing.sm,
    },
    progressTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    progressTxt: { color: colors.text, fontSize: font.size.md, fontWeight: "600" },
    progressNum: { color: colors.brandMid, fontWeight: "900", fontSize: font.size.lg },
    progressPct: { color: colors.brandMid, fontSize: font.size.md, fontWeight: "800" },
    progressBar: { height: 8, borderRadius: radius.full, backgroundColor: colors.glass, overflow: "hidden" },
    progressFill: { height: "100%", borderRadius: radius.full, backgroundColor: colors.primary },
    // trilha
    track: { marginTop: spacing.xs },
    row: { flexDirection: "row" },
    rail: { width: RAIL_W, position: "relative", alignItems: "center" },
    lineTop: {
      position: "absolute", top: 0, height: NODE_MT + NODE / 2,
      left: RAIL_W / 2 - 1, width: 2, backgroundColor: colors.glassBorder,
    },
    lineBottom: {
      position: "absolute", top: NODE_MT + NODE / 2, bottom: 0,
      left: RAIL_W / 2 - 1, width: 2, backgroundColor: colors.glassBorder,
    },
    lineOn: { backgroundColor: colors.primary },
    node: {
      marginTop: NODE_MT, width: NODE, height: NODE, borderRadius: NODE / 2,
      backgroundColor: colors.glass, borderWidth: 1, borderColor: colors.glassBorder,
      alignItems: "center", justifyContent: "center", zIndex: 2,
    },
    nodeDone: { backgroundColor: colors.primary, borderColor: colors.primary },
    nodeNext: { backgroundColor: colors.surface, borderColor: colors.primary, borderWidth: 2 },
    // cartão do passo
    stepCard: {
      flex: 1, flexDirection: "row", alignItems: "center", gap: spacing.sm,
      backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
      borderRadius: radius.lg, padding: spacing.md,
      marginLeft: spacing.sm, marginBottom: spacing.md,
    },
    stepCardNext: { borderColor: colors.primary, backgroundColor: "rgba(64,128,151,0.10)" },
    stepCardDone: { borderColor: "rgba(112,168,176,0.45)" },
    pressed: { opacity: 0.7 },
    stepEyebrowRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, flexWrap: "wrap" },
    stepEyebrow: { color: colors.textMuted, fontSize: 10, fontWeight: "800", letterSpacing: 1.2 },
    badgeNext: {
      backgroundColor: colors.primary, borderRadius: radius.full,
      paddingHorizontal: 8, paddingVertical: 2,
    },
    badgeNextTxt: { color: "#fff", fontSize: 9, fontWeight: "800", letterSpacing: 0.6 },
    stepTitulo: { color: colors.text, fontSize: font.size.md, fontWeight: "700", marginTop: 3 },
    stepStatus: { color: colors.textMuted, fontSize: font.size.sm, fontWeight: "600", marginTop: 2 },
    rodape: { color: colors.textMuted, fontSize: font.size.sm, textAlign: "center", marginTop: spacing.sm },
  });
