import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useColors } from "@/contexts/ThemeContext";
import { useMembro } from "@/lib/useMembro";
import { listarAnotacoes, type Anotacao } from "@/lib/devocional";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { useT } from "@/lib/i18n";
import { font, radius, spacing, type Palette } from "@/constants/theme";

export default function AnotacoesScreen() {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const t = useT();
  const { membro } = useMembro();
  const [itens, setItens] = useState<Anotacao[]>([]);
  const [estado, setEstado] = useState<"loading" | "pronto" | "erro">("loading");

  const carregar = useCallback(() => {
    if (!membro?.membroId) {
      setItens([]);
      setEstado("pronto");
      return;
    }
    setEstado("loading");
    listarAnotacoes(membro.membroId)
      .then((r) => { setItens(r); setEstado("pronto"); })
      .catch(() => setEstado("erro"));
  }, [membro?.membroId]);

  useFocusEffect(carregar);

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={styles.back} accessibilityRole="button" accessibilityLabel={t("Voltar")}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.title}>{t("Minhas anotações")}</Text>
        <View style={{ width: 24 }} />
      </View>

      {estado === "loading" ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} />
      ) : estado === "erro" ? (
        <ErrorState onRetry={carregar} />
      ) : itens.length === 0 ? (
        <EmptyState
          icon="create-outline"
          titulo={t("Nenhuma anotação ainda")}
          texto={t("Ao ler o devocional, escreva o que Deus falou com você — guardamos aqui pra você reler.")}
          acao={{ label: t("Ir para o devocional"), onPress: () => router.replace("/devocional") }}
        />
      ) : (
        <FlatList
          data={itens}
          keyExtractor={(a) => a.id}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
          renderItem={({ item }) => (
            <View style={styles.card} accessible accessibilityLabel={`${item.passagem ?? item.titulo ?? ""}. ${item.texto}`}>
              <View style={styles.cardTop}>
                <Text style={styles.passagem} numberOfLines={1}>{item.passagem || item.titulo || t("Devocional")}</Text>
                <Text style={styles.data}>{new Date(`${item.data}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}</Text>
              </View>
              <Text style={styles.texto}>{item.texto}</Text>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: spacing.lg, paddingBottom: spacing.md },
    back: { width: 24 },
    title: { color: colors.text, fontSize: font.size.lg, fontWeight: "800" },
    list: { padding: spacing.lg, paddingTop: 0, paddingBottom: 120 },
    card: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md, gap: 6 },
    cardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    passagem: { color: colors.brandMid, fontSize: font.size.sm, fontWeight: "700", flex: 1 },
    data: { color: colors.textMuted, fontSize: 11 },
    texto: { color: colors.text, fontSize: font.size.md, lineHeight: 22 },
  });
