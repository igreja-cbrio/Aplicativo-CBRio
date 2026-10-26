import { Text } from "@/components/ui/Typography";
import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useColors } from "@/contexts/ThemeContext";
import { useT } from "@/lib/i18n";
import { subirUmNivel } from "@/lib/hierarquia";
import type { ConteudoPasta } from "@/lib/conteudos";
import { carregarCatalogo } from "@/lib/conteudosApi";
import { font, radius, spacing, type Palette } from "@/constants/theme";

// A pasta (curso/série) com as partes em ordem. Lê do MESMO cache do
// catálogo — a tela recebe só o id por parâmetro.
export default function ConteudoPastaScreen() {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const t = useT();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [pasta, setPasta] = useState<ConteudoPasta | null>(null);
  const [sumiu, setSumiu] = useState(false);

  const carregar = useCallback(async () => {
    try {
      const d = await carregarCatalogo();
      const p = d.itens.find((i): i is ConteudoPasta => i.tipo === "pasta" && i.id === id);
      if (p) setPasta(p);
      else setSumiu(true); // despublicada no meio do caminho
    } catch {
      setSumiu(true);
    }
  }, [id]);
  useFocusEffect(useCallback(() => { carregar(); }, [carregar]));

  function dur(s: number | null): string | null {
    if (!s) return null;
    return `${Math.max(1, Math.round(s / 60))} min`;
  }

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
        ) : !pasta ? (
          <View style={styles.center}><ActivityIndicator color={colors.brandMid} /></View>
        ) : (
          <>
            {pasta.capa_url && <Image source={{ uri: pasta.capa_url }} style={styles.capa} />}
            {pasta.descricao ? <Text style={styles.descricao}>{pasta.descricao}</Text> : null}
            <Text style={styles.secao}>{pasta.partes.length} {t(pasta.partes.length === 1 ? "parte" : "partes")}</Text>
            {pasta.partes.map((v, idx) => (
              <Pressable
                key={v.id}
                style={styles.parte}
                onPress={() => router.navigate({ pathname: "/conteudo-video", params: { id: v.id, pasta: pasta.id } })}
              >
                <Text style={styles.parteNum}>{idx + 1}</Text>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={styles.parteTitulo} numberOfLines={2}>{v.titulo}</Text>
                  {dur(v.duracao_seg) ? <Text style={styles.parteDur}>{dur(v.duracao_seg)}</Text> : null}
                </View>
                <Ionicons name="play-circle-outline" size={24} color={colors.brandMid} />
              </Pressable>
            ))}
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
    capa: { width: "100%", aspectRatio: 16 / 9, borderRadius: radius.lg, backgroundColor: colors.glass },
    descricao: { color: colors.textMuted, fontSize: font.size.md, lineHeight: 20 },
    secao: { color: colors.text, fontSize: font.size.md, fontWeight: "800", marginTop: spacing.sm },
    parte: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.glassBorder, borderRadius: radius.lg, padding: spacing.md },
    parteNum: { color: colors.brandMid, fontSize: font.size.lg, fontWeight: "800", width: 26, textAlign: "center" },
    parteTitulo: { color: colors.text, fontSize: font.size.md, fontWeight: "600" },
    parteDur: { color: colors.textMuted, fontSize: font.size.sm },
  });
