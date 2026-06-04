import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "@/components/ui/Button";
import { useColors } from "@/contexts/ThemeContext";
import {
  getCulto,
  formatCultoHora,
  formatDataLonga,
  type CultoDetalhe,
} from "@/lib/cultos";
import { font, radius, spacing, type Palette } from "@/constants/theme";

const END = "Av. das Américas, 7907 — Open Mall (subsolo), Barra da Tijuca, Rio de Janeiro";

function nomeCurto(nome: string | null) {
  if (!nome) return "Culto";
  return nome.replace(/\s*[—–-]\s*\d{2}\/\d{2}\/\d{4}\s*$/, "").trim() || "Culto";
}

export default function CultoDetalheScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const router = useRouter();

  const [culto, setCulto] = useState<CultoDetalhe | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    getCulto(id)
      .then(setCulto)
      .finally(() => setLoading(false));
  }, [id]);

  function abrirMaps() {
    Linking.openURL(`http://maps.apple.com/?q=${encodeURIComponent(END)}`);
  }

  function abrirYoutube() {
    if (!culto?.youtube_video_id) {
      Linking.openURL("https://cbrio.tv");
      return;
    }
    Linking.openURL(`https://youtu.be/${culto.youtube_video_id}`);
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={8} style={styles.back}>
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </Pressable>
          <Text style={styles.title}>Culto</Text>
          <View style={{ width: 24 }} />
        </View>

        {loading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} />
        ) : !culto ? (
          <Text style={styles.muted}>Culto não encontrado.</Text>
        ) : (
          <>
            <View
              style={[
                styles.hero,
                culto.service_type?.color ? { backgroundColor: culto.service_type.color } : null,
              ]}
            >
              <Text style={styles.heroNome}>{nomeCurto(culto.nome)}</Text>
              <Text style={styles.heroData}>{formatDataLonga(culto.data)}</Text>
              <View style={styles.heroHoraRow}>
                <Ionicons name="time-outline" size={18} color="#fff" />
                <Text style={styles.heroHora}>{formatCultoHora(culto.hora)}</Text>
              </View>
            </View>

            {!!culto.service_type?.description && (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Sobre o culto</Text>
                <Text style={styles.cardTxt}>{culto.service_type.description}</Text>
              </View>
            )}

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Onde acontece</Text>
              <View style={styles.row}>
                <Ionicons name="location-outline" size={18} color={colors.brandMid} />
                <Text style={styles.rowTxt}>{END}</Text>
              </View>
              <Button title="Abrir no mapa" variant="ghost" onPress={abrirMaps} />
            </View>

            {(culto.service_type?.has_online_stream || culto.youtube_video_id) && (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Online</Text>
                <Text style={styles.cardTxt}>
                  Acompanhe ao vivo na CBRio TV. Se ainda não começou, o link
                  abre o canal — o vídeo aparece quando entrar no ar.
                </Text>
                <Button
                  title={culto.youtube_video_id ? "Assistir no YouTube" : "Abrir cbrio.tv"}
                  onPress={abrirYoutube}
                />
              </View>
            )}

            {culto.service_type?.has_kids && (
              <View style={styles.card}>
                <View style={styles.row}>
                  <Ionicons name="happy-outline" size={20} color={colors.brandMid} />
                  <Text style={styles.cardTitle}>CBKids neste culto</Text>
                </View>
                <Text style={styles.cardTxt}>
                  Tem programação para as crianças (4 a 11 anos) acontecendo
                  paralelamente. Faça o check-in na chegada.
                </Text>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    content: { padding: spacing.lg, paddingBottom: 140, gap: spacing.md },
    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    back: { width: 24 },
    title: { color: colors.text, fontSize: font.size.lg, fontWeight: "800" },
    muted: { color: colors.textMuted, fontSize: font.size.md, textAlign: "center", marginTop: spacing.lg },
    hero: {
      padding: spacing.lg,
      borderRadius: radius.lg,
      backgroundColor: colors.primary,
      gap: spacing.xs,
    },
    heroNome: { color: "#fff", fontSize: font.size.xxl, fontWeight: "900" },
    heroData: { color: "#fff", fontSize: font.size.md, opacity: 0.95 },
    heroHoraRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: spacing.xs },
    heroHora: { color: "#fff", fontSize: font.size.md, fontWeight: "700" },
    card: {
      padding: spacing.md,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.glassBorder,
      backgroundColor: colors.surface,
      gap: spacing.sm,
    },
    cardTitle: { color: colors.text, fontSize: font.size.md, fontWeight: "800" },
    cardTxt: { color: colors.textMuted, fontSize: font.size.sm, lineHeight: 20 },
    row: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    rowTxt: { color: colors.text, fontSize: font.size.sm, flex: 1 },
  });
