import { ScrollView } from "@/components/navigation/DockContent";
import { Text } from "@/components/ui/Typography";
import { useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Stack, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Constants from "expo-constants";
import { SafeAreaView } from "react-native-safe-area-context";
import { useColors } from "@/contexts/ThemeContext";
import { useT } from "@/lib/i18n";
import { subirUmNivel } from "@/lib/hierarquia";
import { limparCache } from "@/lib/cache";
import { useDialogo } from "@/components/ui/Dialogo";
import { font, radius, spacing, type Palette } from "@/constants/theme";

// Tela sóbria de propósito: as duas primeiras linhas são de verdade (versão
// instalada e limpeza do cache local, a mesma do sair). A terceira é a porta
// dos créditos de quem fez o app (25/11/2026, dia do lançamento).
export default function ConfiguracoesAvancadasScreen() {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const router = useRouter();
  const t = useT();
  const dlg = useDialogo();
  const [limpo, setLimpo] = useState(false);

  async function limpar() {
    await limparCache();
    setLimpo(true);
  }

  async function muitoAvancadas() {
    const sim = await dlg.confirmar({
      titulo: t("Tem certeza?"),
      mensagem: t("Daqui pra frente é por sua conta."),
      acao: t("Sim"),
    });
    if (sim) router.navigate("/creditos");
  }

  return (
    <SafeAreaView style={styles.safe} edges={["left", "right"]}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Pressable onPress={() => subirUmNivel()} hitSlop={8} style={styles.back}>
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </Pressable>
          <Text style={styles.title}>{t("Configurações avançadas")}</Text>
          <View style={{ width: 24 }} />
        </View>

        <View style={styles.card}>
          <View style={styles.linha}>
            <Ionicons name="phone-portrait-outline" size={20} color={colors.text} />
            <Text style={styles.label}>{t("Versão do aplicativo")}</Text>
            <Text style={styles.valor}>{Constants.expoConfig?.version ?? "—"}</Text>
          </View>

          <Pressable
            style={({ pressed }) => [styles.linha, pressed && { opacity: 0.7 }]}
            onPress={limpar}
          >
            <Ionicons name="trash-bin-outline" size={20} color={colors.text} />
            <View style={{ flex: 1 }}>
              <Text style={styles.labelSolto}>{t("Limpar dados temporários")}</Text>
              <Text style={styles.hint}>
                {limpo
                  ? t("Pronto. Nada da sua conta foi apagado.")
                  : t("Apaga o que o app guardou para abrir mais rápido.")}
              </Text>
            </View>
            {limpo && <Ionicons name="checkmark" size={18} color={colors.brandMid} />}
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.linha, pressed && { opacity: 0.7 }]}
            onPress={muitoAvancadas}
          >
            <Ionicons name="construct-outline" size={20} color={colors.text} />
            <Text style={styles.label}>{t("Configurações muito avançadas")}</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </Pressable>
        </View>
      </ScrollView>
      <dlg.Dialogo />
    </SafeAreaView>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    content: { padding: spacing.lg, paddingBottom: 140, gap: spacing.lg },
    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    back: { width: 24 },
    title: { color: colors.text, fontSize: font.size.lg, fontWeight: "800" },
    card: {
      padding: spacing.md,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.glassBorder,
      backgroundColor: colors.surface,
      gap: spacing.sm,
    },
    linha: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: 10 },
    label: { flex: 1, color: colors.text, fontSize: font.size.sm, fontWeight: "700" },
    labelSolto: { color: colors.text, fontSize: font.size.sm, fontWeight: "700" },
    valor: { color: colors.textMuted, fontSize: font.size.sm },
    hint: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  });
