import { useCallback, useMemo, useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useColors } from "@/contexts/ThemeContext";
import { useT } from "@/lib/i18n";
import { novosConteudos, type ConteudoItem } from "@/lib/conteudos";
import { carregarCatalogo } from "@/lib/conteudosApi";
import { font, radius, spacing, type Palette } from "@/constants/theme";

/**
 * Faixa "Novos em Conteúdos" da Home (21/10/2026): 3–5 capas dos últimos
 * publicados (publicado_em). A busca do catálogo serve quem já sabe o que
 * procura; esta faixa é o que faz alguém DESCOBRIR que o conteúdo existe.
 * Sem dado (ou erro), não renderiza nada — a Home segue de pé.
 */
export function NovosConteudos() {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const t = useT();
  const [novos, setNovos] = useState<ConteudoItem[]>([]);

  useFocusEffect(
    useCallback(() => {
      let vivo = true;
      carregarCatalogo()
        .then((d) => { if (vivo) setNovos(novosConteudos(d.itens, 5)); })
        .catch(() => { /* faixa é opcional — a Home nunca quebra por ela */ });
      return () => { vivo = false; };
    }, []),
  );

  if (novos.length === 0) return null;

  function abrir(i: ConteudoItem) {
    if (i.tipo === "pasta") router.navigate({ pathname: "/conteudo-pasta", params: { id: i.id } });
    else router.navigate({ pathname: "/conteudo-video", params: { id: i.id } });
  }

  return (
    <View style={{ gap: spacing.sm }}>
      <View style={styles.cabecalho}>
        <Text style={styles.titulo}>{t("Novos em Conteúdos")}</Text>
        <Pressable onPress={() => router.navigate("/conteudos")} hitSlop={8} accessibilityRole="button">
          <Text style={styles.verTodos}>{t("Ver todos")}</Text>
        </Pressable>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
        {novos.map((i) => {
          const capa = i.tipo === "pasta" ? i.capa_url : i.thumbnail_url;
          return (
            <Pressable key={i.id} style={styles.card} onPress={() => abrir(i)}>
              {capa ? <Image source={{ uri: capa }} style={styles.thumb} /> : (
                <View style={[styles.thumb, styles.thumbVazio]}>
                  <Ionicons name={i.tipo === "pasta" ? "albums-outline" : "videocam-outline"} size={22} color={colors.textMuted} />
                </View>
              )}
              <Text style={styles.cardTitulo} numberOfLines={2}>{i.titulo}</Text>
              {i.tipo === "pasta" && <Text style={styles.cardSub}>{i.partes.length} {t(i.partes.length === 1 ? "parte" : "partes")}</Text>}
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    cabecalho: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    titulo: { color: colors.text, fontSize: font.size.md, fontWeight: "800" },
    verTodos: { color: colors.brandMid, fontSize: font.size.sm, fontWeight: "700" },
    card: { width: 170, gap: 4 },
    thumb: { width: 170, height: 96, borderRadius: radius.md, backgroundColor: colors.surface },
    thumbVazio: { alignItems: "center", justifyContent: "center" },
    cardTitulo: { color: colors.text, fontSize: font.size.sm, fontWeight: "600" },
    cardSub: { color: colors.textMuted, fontSize: 11 },
  });
