import { ScrollView } from "@/components/navigation/DockContent";
import { Text, TextInput } from "@/components/ui/Typography";
import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Image, Pressable, RefreshControl, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useColors } from "@/contexts/ThemeContext";
import { useT } from "@/lib/i18n";
import { subirUmNivel } from "@/lib/hierarquia";
import { filtrarCatalogo, type Catalogo, type ConteudoItem } from "@/lib/conteudos";
import { carregarCatalogo } from "@/lib/conteudosApi";
import { font, radius, spacing, type Palette } from "@/constants/theme";

// Conteúdos (21/10/2026): o catálogo de cursos e vídeos do Vimeo da igreja.
// Busca/filtro/ordem são client-side sobre o catálogo inteiro (centenas de
// itens, resposta única com total_videos — quem corta avisa).

function dur(s: number | null): string | null {
  if (!s) return null;
  return `${Math.max(1, Math.round(s / 60))} min`;
}

export function abrirItem(i: ConteudoItem) {
  if (i.tipo === "pasta") router.navigate({ pathname: "/conteudo-pasta", params: { id: i.id } });
  else router.navigate({ pathname: "/conteudo-video", params: { id: i.id } });
}

export default function ConteudosScreen() {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const t = useT();
  const [d, setD] = useState<Catalogo | null>(null);
  const [erro, setErro] = useState(false);
  const [atualizando, setAtualizando] = useState(false);
  const [termo, setTermo] = useState("");
  const [categoriaId, setCategoriaId] = useState<string | null>(null);
  const [ordem, setOrdem] = useState<"recentes" | "antigos">("recentes");

  const carregar = useCallback(async (forcar = false) => {
    try {
      setD(await carregarCatalogo(forcar));
      setErro(false);
    } catch {
      // Erro é DITO — nunca catálogo vazio mudo (sem cache pra servir).
      setErro(true);
    }
  }, []);
  useFocusEffect(useCallback(() => { carregar(); }, [carregar]));

  const itens = useMemo(
    () => (d ? filtrarCatalogo(d.itens, { termo, categoriaId, ordem }) : []),
    [d, termo, categoriaId, ordem],
  );
  const destaques = useMemo(
    () => (d && !termo && !categoriaId ? d.itens.filter((i) => i.destaque) : []),
    [d, termo, categoriaId],
  );

  function Linha({ i }: { i: ConteudoItem }) {
    const capa = i.tipo === "pasta" ? i.capa_url : i.thumbnail_url;
    return (
      <Pressable style={styles.card} onPress={() => abrirItem(i)}>
        <View style={styles.thumbWrap}>
          {capa ? <Image source={{ uri: capa }} style={styles.thumb} /> : (
            <View style={[styles.thumb, styles.thumbVazio]}>
              <Ionicons name={i.tipo === "pasta" ? "albums-outline" : "videocam-outline"} size={22} color={colors.textMuted} />
            </View>
          )}
          {i.tipo === "video" && <View style={styles.playOverlay}><Ionicons name="play" size={18} color="#fff" /></View>}
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={styles.cardTitulo} numberOfLines={2}>{i.titulo}</Text>
          <Text style={styles.cardSub}>
            {i.tipo === "pasta"
              ? `${i.partes.length} ${t(i.partes.length === 1 ? "parte" : "partes")}`
              : dur(i.duracao_seg) || t("Vídeo")}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
      </Pressable>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["left", "right"]}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={atualizando} onRefresh={async () => { setAtualizando(true); await carregar(true); setAtualizando(false); }} tintColor={colors.brandMid} />}
      >
        <View style={styles.header}>
          <Pressable onPress={() => subirUmNivel()} hitSlop={8} style={styles.back} accessibilityRole="button" accessibilityLabel={t("Voltar")}>
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </Pressable>
          <Text style={styles.title}>{t("Conteúdos")}</Text>
          <View style={{ width: 24 }} />
        </View>

        {erro && !d ? (
          <View style={styles.center}>
            <Text style={styles.vazio}>{t("Não foi possível carregar os conteúdos. Confira sua internet.")}</Text>
            <Pressable style={styles.tentar} onPress={() => carregar(true)}>
              <Text style={styles.tentarTxt}>{t("Tentar de novo")}</Text>
            </Pressable>
          </View>
        ) : !d ? (
          <View style={styles.center}><ActivityIndicator color={colors.brandMid} /></View>
        ) : (
          <>
            <View style={styles.buscaWrap}>
              <Ionicons name="search" size={16} color={colors.textMuted} />
              <TextInput
                value={termo}
                onChangeText={setTermo}
                placeholder={t("Buscar por título")}
                placeholderTextColor={colors.textMuted}
                style={styles.busca}
                autoCorrect={false}
              />
              {termo ? <Pressable onPress={() => setTermo("")} hitSlop={8}><Ionicons name="close-circle" size={16} color={colors.textMuted} /></Pressable> : null}
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
              <Pressable onPress={() => setCategoriaId(null)} style={[styles.chip, !categoriaId && styles.chipAtivo]}>
                <Text style={[styles.chipTxt, !categoriaId && styles.chipTxtAtivo]}>{t("Todas")}</Text>
              </Pressable>
              {d.categorias.map((c) => (
                <Pressable key={c.id} onPress={() => setCategoriaId(categoriaId === c.id ? null : c.id)} style={[styles.chip, categoriaId === c.id && styles.chipAtivo]}>
                  <Text style={[styles.chipTxt, categoriaId === c.id && styles.chipTxtAtivo]}>{c.nome}</Text>
                </Pressable>
              ))}
            </ScrollView>

            <Pressable onPress={() => setOrdem(ordem === "recentes" ? "antigos" : "recentes")} style={styles.ordem} accessibilityRole="button">
              <Ionicons name="swap-vertical" size={14} color={colors.brandMid} />
              <Text style={styles.ordemTxt}>{ordem === "recentes" ? t("Mais recentes") : t("Mais antigos")}</Text>
            </Pressable>

            {destaques.length > 0 && (
              <>
                <Text style={styles.secao}>{t("Em destaque")}</Text>
                {destaques.map((i) => <Linha key={`d-${i.id}`} i={i} />)}
                <Text style={styles.secao}>{t("Todos os conteúdos")}</Text>
              </>
            )}

            {itens.length === 0 ? (
              <Text style={styles.vazio}>{t("Nenhum conteúdo encontrado.")}</Text>
            ) : (
              itens.map((i) => <Linha key={i.id} i={i} />)
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
    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.xs },
    back: { width: 24 },
    title: { color: colors.text, fontSize: font.size.lg, fontWeight: "800" },
    center: { alignItems: "center", paddingVertical: spacing.xl, gap: spacing.md },
    vazio: { color: colors.textMuted, fontSize: font.size.md, textAlign: "center", paddingVertical: spacing.md },
    tentar: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.glassBorder, borderRadius: radius.lg, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
    tentarTxt: { color: colors.brandMid, fontWeight: "700", fontSize: font.size.md },
    buscaWrap: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.glassBorder, borderRadius: radius.lg, paddingHorizontal: spacing.md },
    busca: { flex: 1, color: colors.text, fontSize: font.size.md, paddingVertical: 10 },
    chips: { gap: spacing.xs, paddingVertical: 2 },
    chip: { paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: colors.glassBorder, backgroundColor: colors.surface },
    chipAtivo: { borderColor: colors.brandMid, backgroundColor: colors.glass },
    chipTxt: { color: colors.textMuted, fontSize: font.size.sm, fontWeight: "600" },
    chipTxtAtivo: { color: colors.brandMid },
    ordem: { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start", paddingVertical: 2 },
    ordemTxt: { color: colors.brandMid, fontSize: font.size.sm, fontWeight: "700" },
    secao: { color: colors.text, fontSize: font.size.md, fontWeight: "800", marginTop: spacing.sm },
    card: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.glassBorder, borderRadius: radius.lg, padding: spacing.sm },
    thumbWrap: { position: "relative" },
    thumb: { width: 110, height: 66, borderRadius: radius.md, backgroundColor: colors.glass },
    thumbVazio: { alignItems: "center", justifyContent: "center" },
    playOverlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center" },
    cardTitulo: { color: colors.text, fontSize: font.size.md, fontWeight: "600" },
    cardSub: { color: colors.textMuted, fontSize: font.size.sm },
  });
