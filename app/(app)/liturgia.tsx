// LITURGIA DO CULTO · fase 1, só leitura (25/11/2026)
//
// Pedido do Marcos: quem está escalado precisa ver os horários e os momentos
// do culto sem abrir a escala. Abre pelo relógio no card da escala (aba
// Servir) e pelo relógio de Montar escala. Quem decide se a pessoa vê e o que
// aparece é o servidor (`/app/voluntariado/liturgia/:id`); aqui só exibimos.
// Editar entra na fase 2 — esta tela não tem nenhum botão de escrita.
import { ScrollView } from "@/components/navigation/DockContent";
import { Text } from "@/components/ui/Typography";
import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useColors } from "@/contexts/ThemeContext";
import { apiGet } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { subirUmNivel } from "@/lib/hierarquia";
import { dividirSecoes, duracaoCurta, horaBRT, rotaLiturgia, type ItemLiturgia, type Liturgia } from "@/lib/liturgia";
import { font, radius, spacing, type Palette } from "@/constants/theme";

function fmtDia(iso: string | null): string | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return null;
  const d = new Date(t - 3 * 3600 * 1000);
  return `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export default function LiturgiaScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const t = useT();

  const [dados, setDados] = useState<Liturgia | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Recarrega ao focar: a Produção ajusta o cronograma pelo sistema web.
  const carregar = useCallback(() => {
    if (!id) {
      setErro(t("Culto não encontrado."));
      setLoading(false);
      return;
    }
    setLoading(true);
    setErro(null);
    apiGet<Liturgia>(rotaLiturgia(String(id)))
      .then((r) => setDados(r))
      .catch((e: any) => {
        setDados(null);
        // 403/404 trazem a frase do servidor; falha de rede vira frase da casa.
        setErro(e?.status === 403 || e?.status === 404 ? String(e.message) : t("Não foi possível carregar a liturgia agora."));
      })
      .finally(() => setLoading(false));
  }, [id, t]);

  useFocusEffect(carregar);

  const secoes = dados ? dividirSecoes(dados.itens) : { culto: [], posCulto: [] };
  const total = duracaoCurta(dados?.total_previsto_seg ?? null);

  function renderItem(item: ItemLiturgia, ultimo: boolean) {
    const hora = horaBRT(item.inicio);
    const dur = duracaoCurta(item.previsto_seg);
    return (
      <View key={`${item.secao}-${item.ordem}`} style={[styles.item, !ultimo && styles.itemDivisor]}>
        <Text style={styles.itemHora}>{hora ?? "--:--"}</Text>
        <View style={styles.itemCorpo}>
          <View style={styles.itemLinha}>
            <Text style={styles.itemTitulo}>{item.titulo}</Text>
            {item.especial && (
              <View style={styles.tag}>
                <Text style={styles.tagTxt}>{t("Especial")}</Text>
              </View>
            )}
          </View>
          {!!dur && <Text style={styles.itemDur}>{dur}</Text>}
          {!!item.observacao && <Text style={styles.itemObs}>{item.observacao}</Text>}
        </View>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["left", "right"]}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Pressable onPress={() => subirUmNivel()} hitSlop={12} accessibilityRole="button" accessibilityLabel={t("Voltar")}>
            <Ionicons name="chevron-back" size={26} color={colors.text} />
          </Pressable>
          <Text style={styles.titulo}>{t("Liturgia do culto")}</Text>
          <View style={{ width: 26 }} />
        </View>

        {loading && !dados ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} />
        ) : erro ? (
          <View style={styles.card}>
            <Ionicons name="lock-closed-outline" size={22} color={colors.textMuted} />
            <Text style={styles.cardTxt}>{erro}</Text>
            <Pressable onPress={carregar} accessibilityRole="button" style={styles.tentar}>
              <Text style={styles.tentarTxt}>{t("Tentar de novo")}</Text>
            </Pressable>
          </View>
        ) : dados ? (
          <>
            <View style={styles.hero}>
              <Text style={styles.heroNome}>{dados.culto.nome}</Text>
              <View style={styles.heroLinha}>
                <Ionicons name="time-outline" size={16} color="#fff" />
                <Text style={styles.heroTxt}>
                  {[fmtDia(dados.culto.scheduled_at), horaBRT(dados.culto.scheduled_at)].filter(Boolean).join(" · ")}
                  {total ? ` · ${t("previsto")} ${total}` : ""}
                </Text>
              </View>
            </View>

            {dados.fonte === "padrao" && (
              <View style={styles.aviso}>
                <Ionicons name="information-circle-outline" size={18} color={colors.warning} />
                <Text style={styles.avisoTxt}>
                  {t("Roteiro padrão deste tipo de culto. A Produção ainda pode ajustar os horários.")}
                </Text>
              </View>
            )}

            {dados.fonte === "vazio" ? (
              <View style={styles.card}>
                <Text style={styles.cardTxt}>{t("A liturgia deste culto ainda não foi montada.")}</Text>
              </View>
            ) : (
              <>
                {secoes.culto.length > 0 && (
                  <View style={styles.card}>
                    <Text style={styles.secao}>{t("Culto")}</Text>
                    {secoes.culto.map((it, i) => renderItem(it, i === secoes.culto.length - 1))}
                  </View>
                )}
                {secoes.posCulto.length > 0 && (
                  <View style={styles.card}>
                    <Text style={styles.secao}>{t("Pós-culto")}</Text>
                    {secoes.posCulto.map((it, i) => renderItem(it, i === secoes.posCulto.length - 1))}
                  </View>
                )}
              </>
            )}
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    content: { padding: spacing.lg, paddingBottom: 140, gap: spacing.md },
    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    titulo: { color: colors.text, fontSize: font.size.lg, fontWeight: "800" },
    hero: { padding: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.primary, gap: spacing.xs },
    heroNome: { color: "#fff", fontSize: font.size.xl, fontWeight: "900" },
    heroLinha: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
    heroTxt: { color: "#fff", fontSize: font.size.md, fontWeight: "600", flexShrink: 1 },
    aviso: {
      flexDirection: "row",
      gap: spacing.sm,
      alignItems: "flex-start",
      padding: spacing.md,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.glassBorder,
      backgroundColor: colors.surface,
    },
    avisoTxt: { color: colors.textMuted, fontSize: font.size.sm, lineHeight: 20, flex: 1 },
    card: {
      padding: spacing.md,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.glassBorder,
      backgroundColor: colors.surface,
      gap: spacing.sm,
    },
    cardTxt: { color: colors.textMuted, fontSize: font.size.sm, lineHeight: 20 },
    secao: { color: colors.textMuted, fontSize: 12, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.6 },
    item: { flexDirection: "row", gap: spacing.md, paddingVertical: spacing.sm },
    itemDivisor: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.glassBorder },
    itemHora: { color: colors.primary, fontSize: font.size.md, fontWeight: "800", width: 52, fontVariant: ["tabular-nums"] },
    itemCorpo: { flex: 1, gap: 2 },
    itemLinha: { flexDirection: "row", alignItems: "center", gap: spacing.sm, flexWrap: "wrap" },
    itemTitulo: { color: colors.text, fontSize: font.size.md, fontWeight: "700", flexShrink: 1 },
    itemDur: { color: colors.textMuted, fontSize: font.size.sm },
    itemObs: { color: colors.text, fontSize: font.size.sm, lineHeight: 20 },
    tag: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.glassBorder },
    tagTxt: { color: colors.textMuted, fontSize: 12, fontWeight: "700" },
    tentar: { alignSelf: "flex-start", paddingVertical: 6 },
    tentarTxt: { color: colors.primary, fontSize: font.size.sm, fontWeight: "700" },
  });
