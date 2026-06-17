import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useColors } from "@/contexts/ThemeContext";
import { useT } from "@/lib/i18n";
import { apiGet } from "@/lib/api";
import { trackEvento } from "@/lib/telemetria";
import { font, radius, spacing, type Palette } from "@/constants/theme";

type Comunicado = {
  id: string;
  titulo: string;
  corpo: string;
  foto_url: string | null;
  segmento: string;
  publicado_em: string | null;
};

function quando(iso: string | null): string {
  if (!iso) return "";
  const dias = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (dias <= 0) return "Hoje";
  if (dias === 1) return "Ontem";
  if (dias < 7) return `Há ${dias} dias`;
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

export default function MuralScreen() {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const t = useT();
  const [itens, setItens] = useState<Comunicado[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const carregar = useCallback(async () => {
    try {
      const r = await apiGet<{ comunicados: Comunicado[] }>("/app/comunicados");
      setItens(r.comunicados || []);
    } catch {
      /* mantém o que tem */
    } finally {
      setCarregando(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      carregar();
    }, [carregar])
  );

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); carregar(); }} tintColor={colors.brandMid} />}
      >
        <View style={styles.header}>
          <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))} hitSlop={8} style={styles.back} accessibilityRole="button" accessibilityLabel={t("Voltar")}>
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </Pressable>
          <Text style={styles.title}>{t("Avisos")}</Text>
          <View style={{ width: 24 }} />
        </View>

        {carregando ? (
          <View style={styles.center}><ActivityIndicator color={colors.brandMid} /></View>
        ) : itens.length === 0 ? (
          <View style={styles.center}>
            <Ionicons name="megaphone-outline" size={32} color={colors.textMuted} />
            <Text style={styles.vazio}>{t("Nenhum aviso por enquanto.")}</Text>
          </View>
        ) : (
          itens.map((c) => (
            <Pressable
              key={c.id}
              style={styles.card}
              onPress={() => trackEvento("comunicado_aberto", { id: c.id })}
            >
              {c.foto_url ? <Image source={{ uri: c.foto_url }} style={styles.foto} resizeMode="cover" /> : null}
              <View style={styles.cardBody}>
                <Text style={styles.data}>{quando(c.publicado_em)}</Text>
                <Text style={styles.cardTitulo}>{c.titulo}</Text>
                <Text style={styles.cardCorpo}>{c.corpo}</Text>
              </View>
            </Pressable>
          ))
        )}
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
    center: { alignItems: "center", paddingVertical: spacing.xl, gap: spacing.sm },
    vazio: { color: colors.textMuted, fontSize: font.size.md },
    card: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.glassBorder,
      borderRadius: radius.lg,
      overflow: "hidden",
    },
    foto: { width: "100%", height: 170, backgroundColor: colors.glass },
    cardBody: { padding: spacing.lg, gap: 4 },
    data: { color: colors.brandMid, fontSize: font.size.sm, fontWeight: "700" },
    cardTitulo: { color: colors.text, fontSize: font.size.lg, fontWeight: "800" },
    cardCorpo: { color: colors.textMuted, fontSize: font.size.md, lineHeight: 22, marginTop: 2 },
  });
