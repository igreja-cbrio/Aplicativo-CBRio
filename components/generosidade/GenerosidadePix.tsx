// ============================================================================
// GENEROSIDADE · versão simples (só a chave PIX) — pedido do Marcos (05/08/2026)
//
// É a face da tela `/generosidade` enquanto `FEATURES.generosidade` está
// DESLIGADO. Aqui não há processamento de pagamento nenhum: só a chave da
// igreja pra copiar e um texto. Quando as doações voltarem (Benevity), a mesma
// rota passa a mostrar o módulo completo — uma rota, uma resposta pra "onde eu
// contribuo?".
//
// ⚠️ RISCO DE LOJA (App Store · guideline 3.2.2(iv)): "arrecadar fundos dentro
// do app" é justamente o que fez o módulo de doações sair da submissão em
// out/2026. Mostrar a chave PIX é a mesma família de conteúdo — e sair por OTA
// não torna a regra menos válida. O Marcos pediu ciente disso; o interruptor
// abaixo deixa a decisão a 1 linha de distância, sem mexer em mais nada.
// ============================================================================
import { useMemo, useState } from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { GlassCard } from "@/components/ui/GlassCard";
import { useColors } from "@/contexts/ThemeContext";
import { useT } from "@/lib/i18n";
import { trackEvento } from "@/lib/telemetria";
import { PIX_KEY, PIX_KEY_FORMATADA, PIX_KEY_TIPO, PIX_BENEFICIARIO } from "@/constants/pix";
import { BRAND_FONT } from "@/lib/fonts";
import { font, radius, spacing, type Palette } from "@/constants/theme";

/**
 * Mostrar a chave no iOS? `false` = no iPhone a tela explica e manda pro site
 * (some o risco de 3.2.2(iv) sem perder a informação). Trocar aqui basta.
 */
const CHAVE_VISIVEL_NO_IOS = true;
const PAGINA_CONTRIBUIR = "https://www.cbrio.com.br";

export function GenerosidadePix() {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const t = useT();
  const [copiado, setCopiado] = useState(false);
  const mostrarChave = Platform.OS !== "ios" || CHAVE_VISIVEL_NO_IOS;

  async function copiar() {
    await Clipboard.setStringAsync(PIX_KEY);
    setCopiado(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    trackEvento("pix_chave_copiada", { source: "generosidade" });
    setTimeout(() => setCopiado(false), 2500);
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Pressable
            onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))}
            hitSlop={8}
            style={styles.back}
            accessibilityRole="button"
            accessibilityLabel={t("Voltar")}
          >
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </Pressable>
          <Text style={styles.title}>{t("Generosidade")}</Text>
          <View style={{ width: 24 }} />
        </View>

        <View style={styles.selo}>
          <Ionicons name="gift" size={26} color={colors.brandPale} />
        </View>

        <Text style={styles.intro}>
          {t("Generosidade é um dos valores da nossa jornada. O que entra sustenta a obra: os cultos, o cuidado com as pessoas, o trabalho com as crianças e os projetos da igreja.")}
        </Text>
        <Text style={styles.intro}>
          {t("Sua contribuição é entre você e Deus — sem valor mínimo e sem cobrança.")}
        </Text>

        {mostrarChave ? (
          <GlassCard style={styles.card}>
            <Text style={styles.rotulo}>{t("Chave PIX")} · {t(PIX_KEY_TIPO)}</Text>
            <Text style={styles.chave} selectable>{PIX_KEY_FORMATADA}</Text>
            <Text style={styles.beneficiario}>{PIX_BENEFICIARIO}</Text>

            <Pressable
              onPress={copiar}
              style={({ pressed }) => [styles.btn, copiado && styles.btnOk, pressed && { opacity: 0.85 }]}
              accessibilityRole="button"
              accessibilityLabel={t("Copiar chave PIX")}
            >
              <Ionicons name={copiado ? "checkmark" : "copy-outline"} size={18} color="#fff" />
              <Text style={styles.btnTxt}>{copiado ? t("Chave copiada!") : t("Copiar chave PIX")}</Text>
            </Pressable>

            {/* ⚠️ Sem QR de propósito: QR de PIX exige o BR Code completo
                (`PIX_PAYLOAD`, que está vazio). Um QR só com a chave não é
                lido pelo app do banco — mostraria um código que não funciona. */}
            <Text style={styles.dica}>
              {t("Abra o app do seu banco, escolha PIX por chave e cole. Se quiser, escreva seu nome na descrição.")}
            </Text>
          </GlassCard>
        ) : (
          <GlassCard style={styles.card}>
            <Text style={styles.rotulo}>{t("Como contribuir")}</Text>
            <Text style={styles.dica}>
              {t("Os dados pra contribuir ficam no site da igreja.")}
            </Text>
            <Pressable
              onPress={() => router.navigate(PAGINA_CONTRIBUIR as never)}
              style={({ pressed }) => [styles.btn, pressed && { opacity: 0.85 }]}
              accessibilityRole="button"
            >
              <Ionicons name="open-outline" size={18} color="#fff" />
              <Text style={styles.btnTxt}>{t("Abrir o site da CBRio")}</Text>
            </Pressable>
          </GlassCard>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    content: { padding: spacing.lg, paddingBottom: 40, gap: spacing.md },
    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    back: { width: 24 },
    title: { color: colors.text, fontSize: font.size.lg, fontWeight: "800" },
    selo: {
      width: 56, height: 56, borderRadius: radius.full, alignSelf: "center",
      backgroundColor: colors.primary, alignItems: "center", justifyContent: "center",
      marginTop: spacing.sm,
    },
    intro: { color: colors.textMuted, fontSize: font.size.md, lineHeight: 22 },
    card: { padding: spacing.lg, gap: spacing.sm, borderRadius: radius.lg },
    rotulo: {
      color: colors.brandMid, fontSize: 12, fontWeight: "800",
      textTransform: "uppercase", letterSpacing: 0.5,
    },
    chave: { color: colors.text, fontSize: font.size.lg, fontFamily: BRAND_FONT },
    beneficiario: { color: colors.textMuted, fontSize: font.size.sm },
    btn: {
      flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
      backgroundColor: colors.primary, borderRadius: radius.full,
      paddingVertical: 14, marginTop: spacing.xs,
    },
    btnOk: { backgroundColor: colors.success },
    btnTxt: { color: "#fff", fontSize: font.size.md, fontWeight: "700" },
    dica: { color: colors.textMuted, fontSize: font.size.sm, lineHeight: 19 },
  });
