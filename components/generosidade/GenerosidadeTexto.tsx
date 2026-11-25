import { ScrollView } from "@/components/navigation/DockContent";
import { Text } from "@/components/ui/Typography";
import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { GlassCard } from "@/components/ui/GlassCard";
import { useColors } from "@/contexts/ThemeContext";
import { useT } from "@/lib/i18n";
import * as Clipboard from "expo-clipboard";
import { PIX_KEY } from "@/constants/pix";
import { subirUmNivel } from "@/lib/hierarquia";
import { font, radius, spacing, type Palette } from "@/constants/theme";

export function GenerosidadeTexto() {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const t = useT();
  const [copiado, setCopiado] = useState(false);
  const [erroCopia, setErroCopia] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  async function copiarChave() {
    if (timer.current) clearTimeout(timer.current);
    setCopiado(false);
    setErroCopia(false);
    try {
      const ok = await Clipboard.setStringAsync(PIX_KEY);
      if (!ok) throw new Error("clipboard");
      setCopiado(true);
      timer.current = setTimeout(() => setCopiado(false), 3000);
    } catch {
      setErroCopia(true);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={["left", "right"]}>
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
          <Ionicons name="gift-outline" size={28} color="#fff" />
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

        <View style={styles.pixCard}>
          <Text style={styles.rotulo}>{t("Chave PIX")}</Text>
          <Text style={styles.chave} selectable>{PIX_KEY}</Text>
          <Text style={styles.p}>
            {t("Copie a chave e cole na opção Pix do seu banco. Informe o valor e confira os dados antes de confirmar.")}
          </Text>
          <Pressable
            onPress={copiarChave}
            style={({ pressed }) => [styles.btn, pressed && { opacity: 0.85 }]}
            accessibilityRole="button"
            accessibilityLabel={t("Copiar chave Pix")}
          >
            <Ionicons name={copiado ? "checkmark" : "copy-outline"} size={18} color="#fff" />
            <Text style={styles.btnTxt} accessibilityLiveRegion="polite">
              {copiado ? t("Copiado!") : t("Copiar chave Pix")}
            </Text>
          </Pressable>
          {erroCopia && (
            <Text style={styles.p} accessibilityRole="alert">
              {t("Não foi possível copiar. Toque e segure a chave acima para copiá-la.")}
            </Text>
          )}
          <Pressable
            onPress={() => router.navigate("/fale-conosco")}
            style={({ pressed }) => [styles.btnSec, pressed && { opacity: 0.85 }]}
            accessibilityRole="button"
          >
            <Ionicons name="chatbubble-ellipses-outline" size={18} color={colors.text} />
            <Text style={styles.btnSecTxt}>{t("Falar com a igreja")}</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    content: { padding: spacing.lg, paddingBottom: 40, gap: spacing.md },
    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
    back: { width: 24 },
    title: { flex: 1, textAlign: "center", color: colors.text, fontSize: font.size.lg, fontWeight: "800" },
    selo: {
      width: 56, height: 56, borderRadius: radius.full, alignSelf: "center",
      backgroundColor: colors.primary, alignItems: "center", justifyContent: "center",
      marginTop: spacing.sm,
    },
    lead: { color: colors.text, fontSize: font.size.lg, fontWeight: "700", textAlign: "center" },
    card: { padding: spacing.lg, gap: spacing.sm, borderRadius: radius.lg },
    pixCard: {
      padding: spacing.lg, gap: spacing.sm, borderRadius: radius.lg,
      backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    },
    chave: { color: colors.text, fontSize: font.size.lg, fontWeight: "700" },
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
    btnSec: {
      flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
      borderRadius: radius.full, borderWidth: 1, borderColor: colors.border,
      paddingVertical: 14, marginTop: spacing.xs,
    },
    btnSecTxt: { color: colors.text, fontSize: font.size.md, fontWeight: "700" },
  });
