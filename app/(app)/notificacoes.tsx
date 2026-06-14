import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  SectionList,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Stack, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useColors } from "@/contexts/ThemeContext";
import { useNotificacoes, type AppNotificacao } from "@/lib/useNotificacoes";
import { EmptyState } from "@/components/ui/EmptyState";
import { useT } from "@/lib/i18n";
import { font, radius, spacing, type Palette } from "@/constants/theme";

const ICONES: Record<string, keyof typeof Ionicons.glyphMap> = {
  escala: "hand-left",
  sos: "alert-circle",
  cuidado: "heart",
  grupo_pedido: "people",
  batismo: "water",
  culto: "videocam",
  next: "sparkles",
  devocional: "book",
  aniversario: "gift",
};

// tipo técnico -> categoria amigável (pros filtros)
const CATEGORIA: Record<string, string> = {
  escala: "Voluntariado",
  sos: "Cuidados",
  cuidado: "Cuidados",
  grupo_pedido: "Grupos",
  batismo: "Batismo",
  culto: "Cultos",
  next: "NEXT",
  devocional: "Devocional",
  aniversario: "Outros",
};

function iconePorTipo(tipo: string): keyof typeof Ionicons.glyphMap {
  return ICONES[tipo] ?? "notifications";
}

function formatTempo(iso: string, t: (s: string) => string) {
  const d = new Date(iso);
  const diff = Math.max(0, Date.now() - d.getTime());
  const min = Math.floor(diff / 60000);
  if (min < 1) return t("agora");
  if (min < 60) return `${min} ${t("min")}`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h`;
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

/** Rótulo da seção por dia: Hoje / Ontem / data. */
function rotuloDia(iso: string, t: (s: string) => string): string {
  const d = new Date(iso);
  d.setHours(0, 0, 0, 0);
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const dias = Math.round((hoje.getTime() - d.getTime()) / 86400000);
  if (dias <= 0) return t("Hoje");
  if (dias === 1) return t("Ontem");
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "long" });
}

export default function NotificacoesScreen() {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const router = useRouter();
  const t = useT();
  const { itens, loading, marcarLida, marcarTodasLidas } = useNotificacoes();
  const [filtro, setFiltro] = useState<string>("Todas");

  const naoLidas = itens.filter((n) => !n.lida_em).length;

  // Categorias presentes (pros chips de filtro)
  const categorias = useMemo(() => {
    const set = new Set<string>();
    itens.forEach((n) => set.add(CATEGORIA[n.tipo] ?? "Outros"));
    return Array.from(set);
  }, [itens]);

  // Filtra + agrupa por dia em seções
  const secoes = useMemo(() => {
    const filtrados = itens.filter((n) => {
      if (filtro === "Todas") return true;
      if (filtro === "Não lidas") return !n.lida_em;
      return (CATEGORIA[n.tipo] ?? "Outros") === filtro;
    });
    const grupos = new Map<string, AppNotificacao[]>();
    for (const n of filtrados) {
      const r = rotuloDia(n.criada_em, t);
      if (!grupos.has(r)) grupos.set(r, []);
      grupos.get(r)!.push(n);
    }
    return Array.from(grupos.entries()).map(([title, data]) => ({ title, data }));
  }, [itens, filtro, t]);

  function abrir(n: AppNotificacao) {
    if (!n.lida_em) marcarLida(n.id);
    const data = n.data ?? {};
    switch (n.tipo) {
      case "escala":
        router.navigate("/voluntariado"); return;
      case "sos":
      case "cuidado":
        router.navigate("/cuidados"); return;
      case "grupo_pedido": {
        const grupoId = (data as { grupo_id?: string }).grupo_id;
        if (grupoId) router.navigate({ pathname: "/grupo-detalhe", params: { id: grupoId } });
        else router.navigate("/grupos");
        return;
      }
      case "batismo":
        router.navigate("/batismo"); return;
      case "devocional":
        router.navigate("/devocional"); return;
      case "culto": {
        const cultoId = (data as { culto_id?: string }).culto_id;
        if (cultoId) router.navigate({ pathname: "/culto-detalhe", params: { id: cultoId } });
        return;
      }
    }
  }

  function renderItem({ item }: { item: AppNotificacao }) {
    const naoLida = !item.lida_em;
    return (
      <Pressable
        onPress={() => abrir(item)}
        accessibilityRole="button"
        accessibilityLabel={`${item.titulo}. ${item.body}${naoLida ? `. ${t("Não lida")}` : ""}`}
        style={({ pressed }) => [styles.item, naoLida && styles.itemNaoLida, pressed && { opacity: 0.7 }]}
      >
        <View style={[styles.icone, naoLida && styles.iconeNaoLida]}>
          <Ionicons name={iconePorTipo(item.tipo)} size={20} color={naoLida ? "#fff" : colors.brandMid} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={styles.titulo} numberOfLines={1}>{item.titulo}</Text>
          <Text style={styles.body} numberOfLines={2}>{item.body}</Text>
          <Text style={styles.tempo}>{formatTempo(item.criada_em, t)}</Text>
        </View>
        {naoLida && <View style={styles.dot} />}
      </Pressable>
    );
  }

  const chips = ["Todas", ...(naoLidas > 0 ? ["Não lidas"] : []), ...categorias];

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={8}
          style={styles.back}
          accessibilityRole="button"
          accessibilityLabel={t("Voltar")}
        >
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.title}>{t("Notificações")}</Text>
        {naoLidas > 0 ? (
          <Pressable onPress={marcarTodasLidas} hitSlop={8} accessibilityRole="button" accessibilityLabel={t("Marcar todas como lidas")}>
            <Text style={styles.acao}>{t("Marcar todas")}</Text>
          </Pressable>
        ) : (
          <View style={{ width: 24 }} />
        )}
      </View>

      {!loading && itens.length > 0 && chips.length > 1 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}
        >
          {chips.map((c) => {
            const sel = filtro === c;
            return (
              <Pressable
                key={c}
                onPress={() => setFiltro(c)}
                style={[styles.chip, sel && styles.chipSel]}
                accessibilityRole="button"
                accessibilityState={{ selected: sel }}
              >
                <Text style={[styles.chipTxt, sel && styles.chipTxtSel]}>{t(c)}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      )}

      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} />
      ) : itens.length === 0 ? (
        <EmptyState icon="notifications-off-outline" titulo={t("Nenhuma notificação por enquanto.")} />
      ) : (
        <SectionList
          sections={secoes}
          keyExtractor={(n) => n.id}
          renderItem={renderItem}
          renderSectionHeader={({ section }) => <Text style={styles.secaoTitulo}>{section.title}</Text>}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
          stickySectionHeadersEnabled={false}
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
    acao: { color: colors.primary, fontSize: font.size.sm, fontWeight: "700" },
    chips: { paddingHorizontal: spacing.lg, gap: 8, paddingBottom: spacing.md },
    chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: radius.full, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
    chipSel: { backgroundColor: colors.primary, borderColor: colors.primary },
    chipTxt: { color: colors.text, fontSize: font.size.sm, fontWeight: "600" },
    chipTxtSel: { color: "#fff" },
    list: { padding: spacing.lg, paddingTop: 0, paddingBottom: 120 },
    secaoTitulo: { color: colors.textMuted, fontSize: 12, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5, marginTop: spacing.md, marginBottom: spacing.sm },
    item: { flexDirection: "row", gap: spacing.md, padding: spacing.md, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.glassBorder, alignItems: "flex-start" },
    itemNaoLida: { borderColor: colors.primary },
    icone: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.glass, alignItems: "center", justifyContent: "center" },
    iconeNaoLida: { backgroundColor: colors.primary },
    titulo: { color: colors.text, fontSize: font.size.md, fontWeight: "700" },
    body: { color: colors.textMuted, fontSize: font.size.sm, lineHeight: 18 },
    tempo: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
    dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary, marginTop: 6 },
  });
