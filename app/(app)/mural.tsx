import { ScrollView } from "@/components/navigation/DockContent";
import { Text } from "@/components/ui/Typography";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { useAuth } from "@/contexts/AuthContext";
import { apiGet } from "@/lib/api";
import { ErrorState } from "@/components/ui/ErrorState";
import { destinoComunicado, inscricaoDoComunicado } from "@/lib/comunicadoLink";
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
  const { comunicado_id, abrir_inscricao } = useLocalSearchParams<{ comunicado_id?: string; abrir_inscricao?: string }>();
  const { session } = useAuth();
  const uid = session?.user?.id;
  const cargaAtual = useRef(0);
  const aberturaTratada = useRef<string | null>(null);
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
  const [carregadoPara, setCarregadoPara] = useState<string | null>(null);
  const contexto = `${uid ?? ""}|${comunicado_id ?? ""}`;

  const carregar = useCallback(async () => {
    const carga = ++cargaAtual.current;
    try {
      const r = await apiGet<{ comunicados: Comunicado[] }>(`/app/comunicados${comunicado_id ? `?comunicado_id=${encodeURIComponent(comunicado_id)}` : ""}`, { expectedUserId: uid });
      if (carga !== cargaAtual.current) return;
      setCarregadoPara(contexto);
      setItens(r.comunicados || []);
      setFalhou(false);
    } catch {
      // mantém o que tem — mas se não tem NADA, a tela precisa dizer que foi
      // erro (antes mostrava "Nenhum aviso" e o usuário acreditava).
      if (carga === cargaAtual.current) setFalhou(true);
    } finally {
      if (carga === cargaAtual.current) {
        setCarregando(false);
        setRefreshing(false);
      }
    }
  }, [comunicado_id, uid, contexto]);

  useFocusEffect(
    useCallback(() => {
      setItens([]);
      setCarregando(true);
      aberturaTratada.current = null;
      void carregar();
      return () => { cargaAtual.current++; };
    }, [carregar])
  );

  useEffect(() => {
    if (carregadoPara !== contexto || abrir_inscricao !== "1" || !comunicado_id || carregando || falhou || aberturaTratada.current === comunicado_id) return;
    const destino = inscricaoDoComunicado(comunicado_id, itens);
    if (!destino) return;
    aberturaTratada.current = comunicado_id;
    // Consome a intenção antes de sair; voltar ao mural não deve abrir de novo.
    router.setParams({ abrir_inscricao: undefined });
    trackEvento("comunicado_aberto", { entity_id: comunicado_id });
    if (destino.tipo === "app") router.replace(destino.url as never);
    else void Linking.openURL(destino.url).catch(() => {
      void dlg.avisar(t("Não foi possível abrir o link"), t("Tente novamente em instantes."));
    });
  }, [abrir_inscricao, comunicado_id, carregando, falhou, itens, dlg, t, carregadoPara, contexto]);

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
