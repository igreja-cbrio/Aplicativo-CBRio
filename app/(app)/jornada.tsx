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

function brl(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

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
        ) : dados ? (
          <>
            <Text style={styles.intro}>
              {nome ? `${t("Sua caminhada na CBRio")}, ${nome} 💙` : t("Sua caminhada na CBRio 💙")}
            </Text>

            {/* Devocional — card destaque */}
            <Pressable style={styles.heroCard} onPress={() => router.navigate("/devocional")} accessibilityRole="button" accessibilityLabel={t("Devocional")}>
              <View style={styles.heroTop}>
                <Text style={styles.heroEyebrow}>{t("DEVOCIONAL")}</Text>
                <Ionicons name="book" size={18} color={colors.brandPale} />
              </View>
              <Text style={styles.heroNum}>🔥 {dados.devocionalStreak}</Text>
              <Text style={styles.heroLabel}>
                {dados.devocionalStreak === 1 ? t("dia seguido") : t("dias seguidos")} · {dados.devocionalTotal} {t("leituras no total")}
              </Text>
            </Pressable>

            {/* Grid de dimensões */}
            <View style={styles.grid}>
              <Card
                icon="hand-left" titulo={t("Voluntariado")}
                valor={dados.serveVoluntariado ? t("Servindo 💙") : t("Comece a servir")}
                ativo={dados.serveVoluntariado}
                onPress={() => router.navigate("/voluntariado")}
                colors={colors} styles={styles}
              />
              <Card
                icon="people" titulo={t("Grupo")}
                valor={dados.emGrupo ? t("Em um grupo") : t("Encontre um grupo")}
                ativo={dados.emGrupo}
                onPress={() => router.navigate("/grupos")}
                colors={colors} styles={styles}
              />
              <Card
                icon="water" titulo={t("Batismo")}
                valor={dados.batizado ? t("Batizado(a) ✓") : t("Quero me batizar")}
                ativo={dados.batizado}
                onPress={() => router.navigate("/batismo")}
                colors={colors} styles={styles}
              />
              <Card
                icon="gift" titulo={t("Generosidade")}
                valor={dados.generosidadeAno > 0 ? `${brl(dados.generosidadeAno)} ${t("no ano")}` : t("Contribua")}
                ativo={dados.generosidadeAno > 0}
                onPress={() => router.navigate("/generosidade")}
                colors={colors} styles={styles}
              />
            </View>

            <Text style={styles.rodape}>{t("Cada passo conta. Continue crescendo na fé. 🌱")}</Text>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function Card({
  icon, titulo, valor, ativo, onPress, colors, styles,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  titulo: string; valor: string; ativo: boolean; onPress: () => void;
  colors: Palette; styles: ReturnType<typeof makeStyles>;
}) {
  return (
    <Pressable
      style={[styles.card, ativo && styles.cardAtivo]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${titulo}. ${valor}`}
    >
      <View style={[styles.cardIcon, ativo && styles.cardIconAtivo]}>
        <Ionicons name={icon} size={20} color={ativo ? "#fff" : colors.brandMid} />
      </View>
      <Text style={styles.cardTitulo}>{titulo}</Text>
      <Text style={[styles.cardValor, ativo && { color: colors.text }]}>{valor}</Text>
    </Pressable>
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
    heroCard: {
      backgroundColor: colors.primary, borderRadius: radius.xl, padding: spacing.lg, gap: 4,
    },
    heroTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    heroEyebrow: { color: colors.brandPale, fontSize: 11, fontWeight: "800", letterSpacing: 2 },
    heroNum: { color: "#fff", fontSize: 44, fontWeight: "900" },
    heroLabel: { color: "rgba(255,255,255,0.9)", fontSize: font.size.sm, fontWeight: "600" },
    grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
    card: {
      flexGrow: 1, flexBasis: "45%", gap: 6,
      backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
      borderRadius: radius.lg, padding: spacing.md,
    },
    cardAtivo: { borderColor: "rgba(112,168,176,0.5)" },
    cardIcon: {
      width: 38, height: 38, borderRadius: 19, backgroundColor: colors.glass,
      alignItems: "center", justifyContent: "center", marginBottom: 2,
    },
    cardIconAtivo: { backgroundColor: colors.primary },
    cardTitulo: { color: colors.text, fontSize: font.size.md, fontWeight: "700" },
    cardValor: { color: colors.textMuted, fontSize: font.size.sm, fontWeight: "600" },
    rodape: { color: colors.textMuted, fontSize: font.size.sm, textAlign: "center", marginTop: spacing.sm },
  });
