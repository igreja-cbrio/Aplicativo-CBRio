import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Linking,
  Pressable,
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

type Video = {
  video_id: string;
  titulo: string;
  thumbnail_url: string | null;
  publicado_em: string | null;
  duration_seconds: number | null;
  serie: string | null;
};
type Serie = { playlist_id: string; titulo: string; thumbnail_url: string | null; total_videos: number };
type Dados = { canal_live: string; videos: Video[]; series: Serie[] };

function dur(s: number | null): string | null {
  if (!s) return null;
  const m = Math.floor(s / 60);
  return `${m} min`;
}

export default function VideosScreen() {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const t = useT();
  const [d, setD] = useState<Dados | null>(null);

  const carregar = useCallback(async () => {
    try { setD(await apiGet<Dados>("/app/videos")); } catch { /* mantém */ }
  }, []);
  useFocusEffect(useCallback(() => { carregar(); }, [carregar]));

  function abrirVideo(v: Video) {
    trackEvento("video_aberto", { id: v.video_id });
    Linking.openURL(`https://www.youtube.com/watch?v=${v.video_id}`);
  }
  function abrirSerie(s: Serie) {
    trackEvento("serie_aberta", { id: s.playlist_id });
    Linking.openURL(`https://www.youtube.com/playlist?list=${s.playlist_id}`);
  }
  function aoVivo() {
    if (!d?.canal_live) return;
    trackEvento("assistir_ao_vivo");
    Linking.openURL(d.canal_live);
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))} hitSlop={8} style={styles.back} accessibilityRole="button" accessibilityLabel={t("Voltar")}>
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </Pressable>
          <Text style={styles.title}>{t("Pregações")}</Text>
          <View style={{ width: 24 }} />
        </View>

        {/* Ao vivo */}
        <Pressable style={styles.aoVivo} onPress={aoVivo} accessibilityRole="button">
          <View style={styles.aoVivoDot} />
          <Ionicons name="play-circle" size={24} color="#fff" />
          <View style={{ flex: 1 }}>
            <Text style={styles.aoVivoTitulo}>{t("Assistir ao vivo")}</Text>
            <Text style={styles.aoVivoSub}>{t("Abre o culto ao vivo no YouTube")}</Text>
          </View>
          <Ionicons name="open-outline" size={18} color="rgba(255,255,255,0.85)" />
        </Pressable>

        {!d ? (
          <View style={styles.center}><ActivityIndicator color={colors.brandMid} /></View>
        ) : (
          <>
            {/* Séries (carrossel horizontal) */}
            {d.series.length > 0 && (
              <>
                <Text style={styles.secao}>{t("Séries")}</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.serieRow}>
                  {d.series.map((s) => (
                    <Pressable key={s.playlist_id} style={styles.serieCard} onPress={() => abrirSerie(s)}>
                      {s.thumbnail_url ? <Image source={{ uri: s.thumbnail_url }} style={styles.serieThumb} /> : <View style={[styles.serieThumb, styles.thumbVazio]}><Ionicons name="albums-outline" size={22} color={colors.textMuted} /></View>}
                      <Text style={styles.serieTitulo} numberOfLines={2}>{s.titulo}</Text>
                      <Text style={styles.serieQtd}>{s.total_videos} {t("vídeos")}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </>
            )}

            {/* Vídeos recentes */}
            <Text style={styles.secao}>{t("Recentes")}</Text>
            {d.videos.length === 0 ? (
              <Text style={styles.vazio}>{t("Nenhum vídeo por enquanto.")}</Text>
            ) : (
              d.videos.map((v) => (
                <Pressable key={v.video_id} style={styles.video} onPress={() => abrirVideo(v)}>
                  <View style={styles.thumbWrap}>
                    {v.thumbnail_url ? <Image source={{ uri: v.thumbnail_url }} style={styles.thumb} /> : <View style={[styles.thumb, styles.thumbVazio]}><Ionicons name="videocam-outline" size={22} color={colors.textMuted} /></View>}
                    <View style={styles.playOverlay}><Ionicons name="play" size={18} color="#fff" /></View>
                    {dur(v.duration_seconds) ? <Text style={styles.durBadge}>{dur(v.duration_seconds)}</Text> : null}
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={styles.videoTitulo} numberOfLines={2}>{v.titulo}</Text>
                    {v.serie ? <Text style={styles.videoSerie} numberOfLines={1}>{v.serie}</Text> : null}
                    {v.publicado_em ? <Text style={styles.videoData}>{new Date(v.publicado_em).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}</Text> : null}
                  </View>
                </Pressable>
              ))
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
    content: { padding: spacing.lg, paddingBottom: 120, gap: spacing.md },
    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.xs },
    back: { width: 24 },
    title: { color: colors.text, fontSize: font.size.lg, fontWeight: "800" },
    center: { alignItems: "center", paddingVertical: spacing.xl },
    vazio: { color: colors.textMuted, fontSize: font.size.md, textAlign: "center", paddingVertical: spacing.md },
    aoVivo: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: "#E11D48", borderRadius: radius.lg, padding: spacing.lg },
    aoVivoDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: "#fff" },
    aoVivoTitulo: { color: "#fff", fontSize: font.size.lg, fontWeight: "800" },
    aoVivoSub: { color: "rgba(255,255,255,0.9)", fontSize: font.size.sm },
    secao: { color: colors.text, fontSize: font.size.md, fontWeight: "800", marginTop: spacing.sm },
    serieRow: { gap: spacing.sm, paddingVertical: 2 },
    serieCard: { width: 150, gap: 4 },
    serieThumb: { width: 150, height: 84, borderRadius: radius.md, backgroundColor: colors.surface },
    serieTitulo: { color: colors.text, fontSize: font.size.sm, fontWeight: "600" },
    serieQtd: { color: colors.textMuted, fontSize: 11 },
    video: { flexDirection: "row", gap: spacing.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.glassBorder, borderRadius: radius.lg, padding: spacing.sm },
    thumbWrap: { position: "relative" },
    thumb: { width: 120, height: 72, borderRadius: radius.md, backgroundColor: colors.glass },
    thumbVazio: { alignItems: "center", justifyContent: "center" },
    playOverlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center" },
    durBadge: { position: "absolute", bottom: 4, right: 4, backgroundColor: "rgba(0,0,0,0.75)", color: "#fff", fontSize: 10, fontWeight: "700", paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4, overflow: "hidden" },
    videoTitulo: { color: colors.text, fontSize: font.size.md, fontWeight: "600" },
    videoSerie: { color: colors.brandMid, fontSize: font.size.sm },
    videoData: { color: colors.textMuted, fontSize: 11 },
  });
