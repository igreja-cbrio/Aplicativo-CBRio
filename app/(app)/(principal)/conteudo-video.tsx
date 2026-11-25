import { ScrollView } from "@/components/navigation/DockContent";
import { Text } from "@/components/ui/Typography";
import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useColors } from "@/contexts/ThemeContext";
import { useT } from "@/lib/i18n";
import { subirUmNivel } from "@/lib/hierarquia";
import { trackEvento } from "@/lib/telemetria";
import type { ConteudoPasta, ConteudoVideo } from "@/lib/conteudos";
import { carregarCatalogo } from "@/lib/conteudosApi";
import { PlayerVimeo } from "@/components/conteudos/PlayerVimeo";
import { font, radius, spacing, type Palette } from "@/constants/theme";

// Assistir a um vídeo do catálogo, dentro do app. Recebe `id` (e `pasta`
// quando veio de uma): o dado vem do cache do catálogo.
export default function ConteudoVideoScreen() {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const t = useT();
  const { id, pasta: pastaId } = useLocalSearchParams<{ id: string; pasta?: string }>();
  const [video, setVideo] = useState<ConteudoVideo | null>(null);
  const [pasta, setPasta] = useState<ConteudoPasta | null>(null);
  const [sumiu, setSumiu] = useState(false);

  const carregar = useCallback(async () => {
    try {
      const d = await carregarCatalogo();
      const p = pastaId ? d.itens.find((i): i is ConteudoPasta => i.tipo === "pasta" && i.id === pastaId) || null : null;
      const v = p?.partes.find((x) => x.id === id)
        || d.itens.find((i): i is ConteudoVideo => i.tipo === "video" && i.id === id)
        || d.itens.flatMap((i) => (i.tipo === "pasta" ? i.partes : [])).find((x) => x.id === id);
      if (v) { setVideo(v); setPasta(p); } else setSumiu(true);
    } catch {
      setSumiu(true);
    }
  }, [id, pastaId]);
  useFocusEffect(useCallback(() => { carregar(); }, [carregar]));

  const idx = pasta && video ? pasta.partes.findIndex((x) => x.id === video.id) : -1;
  const proxima = pasta && idx >= 0 && idx + 1 < pasta.partes.length ? pasta.partes[idx + 1] : null;

  return (
    <SafeAreaView style={styles.safe} edges={["left", "right"]}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Pressable onPress={() => subirUmNivel()} hitSlop={8} style={styles.back} accessibilityRole="button" accessibilityLabel={t("Voltar")}>
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </Pressable>
          <Text style={styles.title} numberOfLines={1}>{pasta?.titulo || t("Conteúdos")}</Text>
          <View style={{ width: 24 }} />
        </View>

        {sumiu ? (
          <Text style={styles.vazio}>{t("Este conteúdo não está mais disponível.")}</Text>
        ) : !video ? (
          <View style={styles.center}><ActivityIndicator color={colors.brandMid} /></View>
        ) : (
          <>
            <PlayerVimeo
              vimeoId={video.vimeo_id}
              hash={video.vimeo_hash}
              onPlay={() => trackEvento("conteudo_assistido", { entity_id: video.vimeo_id })}
            />
            <Text style={styles.videoTitulo}>{video.titulo}</Text>
            {pasta && idx >= 0 ? <Text style={styles.videoSub}>{t("Parte")} {idx + 1} {t("de")} {pasta.partes.length}</Text> : null}
            {video.descricao ? <Text style={styles.descricao}>{video.descricao}</Text> : null}
            {proxima && (
              <Pressable
                style={styles.proxima}
                onPress={() => router.navigate({ pathname: "/conteudo-video", params: { id: proxima.id, pasta: pasta!.id } })}
              >
                <Ionicons name="play-skip-forward" size={18} color={colors.brandMid} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.proximaLabel}>{t("Próxima parte")}</Text>
                  <Text style={styles.proximaTitulo} numberOfLines={1}>{proxima.titulo}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
              </Pressable>
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
    content: { padding: spacing.lg, paddingBottom: 40, gap: spacing.sm },
    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.xs, gap: spacing.sm },
    back: { width: 24 },
    title: { flex: 1, color: colors.text, fontSize: font.size.lg, fontWeight: "800", textAlign: "center" },
    center: { alignItems: "center", paddingVertical: spacing.xl },
    vazio: { color: colors.textMuted, fontSize: font.size.md, textAlign: "center", paddingVertical: spacing.md },
    videoTitulo: { color: colors.text, fontSize: font.size.lg, fontWeight: "800", marginTop: spacing.xs },
    videoSub: { color: colors.brandMid, fontSize: font.size.sm, fontWeight: "700" },
    descricao: { color: colors.textMuted, fontSize: font.size.md, lineHeight: 20 },
    proxima: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.glassBorder, borderRadius: radius.lg, padding: spacing.md, marginTop: spacing.sm },
    proximaLabel: { color: colors.textMuted, fontSize: 11, fontWeight: "700", textTransform: "uppercase" },
    proximaTitulo: { color: colors.text, fontSize: font.size.md, fontWeight: "600" },
  });
