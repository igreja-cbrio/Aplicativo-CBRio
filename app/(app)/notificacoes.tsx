import { useMemo } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Stack, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useColors } from "@/contexts/ThemeContext";
import { useNotificacoes, type AppNotificacao } from "@/lib/useNotificacoes";
import { useT } from "@/lib/i18n";
import { font, radius, spacing, type Palette } from "@/constants/theme";

const ICONES: Record<string, keyof typeof Ionicons.glyphMap> = {
  escala: "hand-left",
  sos: "alert-circle",
  grupo_pedido: "people",
};

function iconePorTipo(tipo: string): keyof typeof Ionicons.glyphMap {
  return ICONES[tipo] ?? "notifications";
}

function formatTempo(iso: string, t: (s: string) => string) {
  const d = new Date(iso);
  const agora = Date.now();
  const diff = Math.max(0, agora - d.getTime());
  const min = Math.floor(diff / 60000);
  if (min < 1) return t("agora");
  if (min < 60) return `${min} ${t("min")}`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h`;
  const dias = Math.floor(h / 24);
  if (dias < 7) return `${dias}d`;
  return d.toLocaleDateString("pt-BR");
}

export default function NotificacoesScreen() {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const router = useRouter();
  const t = useT();
  const { itens, loading, marcarLida, marcarTodasLidas } = useNotificacoes();

  const naoLidas = itens.filter((n) => !n.lida_em).length;

  function abrir(n: AppNotificacao) {
    if (!n.lida_em) marcarLida(n.id);
    const data = n.data ?? {};
    switch (n.tipo) {
      case "escala":
        router.navigate("/voluntariado");
        return;
      case "sos":
        router.navigate("/cuidados");
        return;
      case "grupo_pedido": {
        const grupoId = (data as { grupo_id?: string }).grupo_id;
        if (grupoId) router.navigate({ pathname: "/grupo-detalhe", params: { id: grupoId } });
        return;
      }
    }
  }

  function renderItem({ item }: { item: AppNotificacao }) {
    const naoLida = !item.lida_em;
    return (
      <Pressable
        onPress={() => abrir(item)}
        style={({ pressed }) => [
          styles.item,
          naoLida && styles.itemNaoLida,
          pressed && { opacity: 0.7 },
        ]}
      >
        <View style={[styles.icone, naoLida && styles.iconeNaoLida]}>
          <Ionicons
            name={iconePorTipo(item.tipo)}
            size={20}
            color={naoLida ? "#fff" : colors.brandMid}
          />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={styles.titulo} numberOfLines={1}>
            {item.titulo}
          </Text>
          <Text style={styles.body} numberOfLines={2}>
            {item.body}
          </Text>
          <Text style={styles.tempo}>{formatTempo(item.criada_em, t)}</Text>
        </View>
        {naoLida && <View style={styles.dot} />}
      </Pressable>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={styles.back}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.title}>{t("Notificações")}</Text>
        {naoLidas > 0 ? (
          <Pressable onPress={marcarTodasLidas} hitSlop={8}>
            <Text style={styles.acao}>{t("Marcar todas")}</Text>
          </Pressable>
        ) : (
          <View style={{ width: 24 }} />
        )}
      </View>

      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} />
      ) : itens.length === 0 ? (
        <View style={styles.vazio}>
          <Ionicons name="notifications-off-outline" size={48} color={colors.textMuted} />
          <Text style={styles.vazioTxt}>{t("Nenhuma notificação por enquanto.")}</Text>
        </View>
      ) : (
        <FlatList
          data={itens}
          keyExtractor={(n) => n.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
        />
      )}
    </SafeAreaView>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      padding: spacing.lg,
      paddingBottom: spacing.md,
    },
    back: { width: 24 },
    title: { color: colors.text, fontSize: font.size.lg, fontWeight: "800" },
    acao: { color: colors.primary, fontSize: font.size.sm, fontWeight: "700" },
    list: { padding: spacing.lg, paddingTop: 0, paddingBottom: 120 },
    item: {
      flexDirection: "row",
      gap: spacing.md,
      padding: spacing.md,
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.glassBorder,
      alignItems: "flex-start",
    },
    itemNaoLida: { borderColor: colors.primary },
    icone: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.glass,
      alignItems: "center",
      justifyContent: "center",
    },
    iconeNaoLida: { backgroundColor: colors.primary },
    titulo: { color: colors.text, fontSize: font.size.md, fontWeight: "700" },
    body: { color: colors.textMuted, fontSize: font.size.sm, lineHeight: 18 },
    tempo: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
    dot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.primary,
      marginTop: 6,
    },
    vazio: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.md, padding: spacing.xl },
    vazioTxt: { color: colors.textMuted, fontSize: font.size.md, textAlign: "center" },
  });
