import { ScrollView } from "@/components/navigation/DockContent";
import { Text } from "@/components/ui/Typography";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, router, useFocusEffect, usePathname, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useColors } from "@/contexts/ThemeContext";
import { useT } from "@/lib/i18n";
import { subirUmNivel } from "@/lib/hierarquia";
import { apiGet } from "@/lib/api";
import { ErrorState } from "@/components/ui/ErrorState";
import { destinoComunicado } from "@/lib/comunicadoLink";
import { useDialogo } from "@/components/ui/Dialogo";
import { trackEvento } from "@/lib/telemetria";
import { font, radius, spacing, type Palette } from "@/constants/theme";

type Comunicado = {
  id: string;
  titulo: string;
  corpo: string;
  foto_url: string | null;
  segmento: string;
  publicado_em: string | null;
  link_inscricao?: string | null;
};

function quando(iso: string | null): string {
  if (!iso) return "";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return ""; // data inválida no banco → não renderiza "Há NaN dias"
  const dias = Math.floor((Date.now() - t) / 86400000);
  if (dias <= 0) return "Hoje";
  if (dias === 1) return "Ontem";
  if (dias < 7) return `Há ${dias} dias`;
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

export default function MuralScreen() {
  const pathname = usePathname();
  const { comunicado_id } = useLocalSearchParams<{ comunicado_id?: string }>();
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const t = useT();
  const dlg = useDialogo();
  async function abrirInscricao(c: Comunicado) {
    const destino = destinoComunicado(c.link_inscricao);
    if (!destino) return;
    trackEvento("comunicado_aberto", { entity_id: c.id });
    if (destino.tipo === "app") router.push(destino.url as never);
    else { try { await Linking.openURL(destino.url); } catch { void dlg.avisar(t("Não foi possível abrir o link"), t("Tente novamente em instantes.")); } }
  }
  const [itens, setItens] = useState<Comunicado[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [falhou, setFalhou] = useState(false);

  const carregar = useCallback(async () => {
    try {
      const r = await apiGet<{ comunicados: Comunicado[] }>(`/app/comunicados${comunicado_id ? `?comunicado_id=${encodeURIComponent(comunicado_id)}` : ""}`);
      setItens(r.comunicados || []);
      setFalhou(false);
    } catch {
      // mantém o que tem — mas se não tem NADA, a tela precisa dizer que foi
      // erro (antes mostrava "Nenhum aviso" e o usuário acreditava).
      setFalhou(true);
    } finally {
      setCarregando(false);
      setRefreshing(false);
    }
  }, [comunicado_id]);

  useFocusEffect(
    useCallback(() => {
      carregar();
    }, [carregar])
  );

  return (
    <SafeAreaView style={styles.safe} edges={["left", "right"]}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); carregar(); }} tintColor={colors.brandMid} />}
      >
        <View style={styles.header}>
          <Pressable onPress={() => subirUmNivel()} hitSlop={8} style={styles.back} accessibilityRole="button" accessibilityLabel={t("Voltar")}>
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </Pressable>
          <Text style={styles.title}>{pathname === "/noticias" ? t("Notícias e avisos") : t("Avisos")}</Text>
          <View style={{ width: 24 }} />
        </View>

        {carregando ? (
          <View style={styles.center}><ActivityIndicator color={colors.brandMid} /></View>
        ) : itens.length === 0 && falhou ? (
          <ErrorState onRetry={() => { setCarregando(true); carregar(); }} />
        ) : itens.length === 0 ? (
          <View style={styles.center}>
            <Ionicons name="megaphone-outline" size={32} color={colors.textMuted} />
            <Text style={styles.vazio}>{t("Nenhum aviso por enquanto.")}</Text>
          </View>
        ) : (
          itens.map((c) => (
            <View
              key={c.id}
              style={styles.card}
            >
              {c.foto_url ? <Image source={{ uri: c.foto_url }} style={styles.foto} resizeMode="cover" /> : null}
              <View style={styles.cardBody}>
                <Text style={styles.data}>{quando(c.publicado_em)}</Text>
                <Text style={styles.cardTitulo}>{c.titulo}</Text>
                <Text style={styles.cardCorpo}>{c.corpo}</Text>
                {destinoComunicado(c.link_inscricao) && <Pressable accessibilityRole="button" onPress={() => void abrirInscricao(c)} style={{ minHeight: 48, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.primary, borderRadius: radius.md, marginTop: spacing.sm }}><Text style={{ color: '#fff', fontWeight: '700' }}>{t("Ver inscrição")}</Text></Pressable>}
              </View>
            </View>
          ))
        )}
      </ScrollView>
      <dlg.Dialogo />
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
