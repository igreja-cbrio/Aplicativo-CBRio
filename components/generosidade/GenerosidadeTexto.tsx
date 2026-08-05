// ============================================================================
// GENEROSIDADE · só o VALOR, sem meio de doação (Marcos · 05/08/2026)
//
// É a face da rota `/generosidade` enquanto `FEATURES.generosidade` está
// desligado. O item voltou ao menu por pedido dele — mas **sem a chave PIX**:
//
// ⚠️⚠️ NÃO COLOCAR CHAVE PIX, QR, LINK DE PAGAMENTO NEM VALOR AQUI.
// Exibir meio de doação dentro do app é o que a guideline **3.2.2(iv)** da App
// Store proíbe, e foi o que tirou o módulo de doações da submissão em out/2026.
// Chegamos a publicar a chave por algumas horas em 05/08 e o Marcos mandou
// retirar ao saber do risco: "não queremos correr o risco disso sair do ar;
// vamos pensar em uma forma de fazer isso posteriormente". Esta tela é sobre o
// VALOR (ensino), não sobre a transação.
// ============================================================================
import { useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { GlassCard } from "@/components/ui/GlassCard";
import { useColors } from "@/contexts/ThemeContext";
import { useT } from "@/lib/i18n";
import { subirUmNivel } from "@/lib/hierarquia";
import { font, radius, spacing, type Palette } from "@/constants/theme";

export function GenerosidadeTexto() {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const t = useT();

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Pressable
            onPress={() => subirUmNivel()}
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

        <Text style={styles.lead}>
          {t("Generosidade é um dos cinco valores da nossa jornada.")}
        </Text>

        <GlassCard style={styles.card}>
          <Text style={styles.p}>
            {t("A gente entende generosidade como um jeito de viver, não como uma cobrança. Quem contribui sustenta o que acontece aqui: os cultos, o cuidado com quem chega, o trabalho com as crianças, os grupos nos bairros e os projetos da igreja.")}
          </Text>
          <Text style={styles.p}>
            {t("É entre você e Deus. Sem valor mínimo, sem lista, sem constrangimento.")}
          </Text>
        </GlassCard>

        <GlassCard style={styles.card}>
          <Text style={styles.rotulo}>{t("Como contribuir")}</Text>
          <Text style={styles.p}>
            {t("Estamos preparando esse caminho dentro do app. Enquanto isso, fale com a secretaria ou com a liderança da sua área — eles te orientam.")}
          </Text>
          <Pressable
            onPress={() => router.navigate("/fale-conosco")}
            style={({ pressed }) => [styles.btn, pressed && { opacity: 0.85 }]}
            accessibilityRole="button"
          >
            <Ionicons name="chatbubble-ellipses-outline" size={18} color="#fff" />
            <Text style={styles.btnTxt}>{t("Falar com a igreja")}</Text>
          </Pressable>
        </GlassCard>
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
    lead: { color: colors.text, fontSize: font.size.lg, fontWeight: "700", textAlign: "center" },
    card: { padding: spacing.lg, gap: spacing.sm, borderRadius: radius.lg },
    rotulo: {
      color: colors.brandMid, fontSize: 12, fontWeight: "800",
      textTransform: "uppercase", letterSpacing: 0.5,
    },
    p: { color: colors.textMuted, fontSize: font.size.md, lineHeight: 22 },
    btn: {
      flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
      backgroundColor: colors.primary, borderRadius: radius.full,
      paddingVertical: 14, marginTop: spacing.xs,
    },
    btnTxt: { color: "#fff", fontSize: font.size.md, fontWeight: "700" },
  });
