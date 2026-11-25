import { Text } from "@/components/ui/Typography";
import { useMemo } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useColors } from "@/contexts/ThemeContext";
import { useT } from "@/lib/i18n";
import { subirUmNivel } from "@/lib/hierarquia";
import { ListaAvisos } from "@/components/comunicados/ListaAvisos";
import { font, spacing, type Palette } from "@/constants/theme";

/**
 * Destino do toque na push de comunicado (`comunicado_id` + `abrir_inscricao`).
 * Quem navega pelo app vê os mesmos avisos na tag "Avisos" de /notificacoes.
 */
export default function MuralScreen() {
  const { comunicado_id, abrir_inscricao } = useLocalSearchParams<{ comunicado_id?: string; abrir_inscricao?: string }>();
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const t = useT();
  return (
    <SafeAreaView style={styles.safe} edges={["left", "right"]}>
      <Stack.Screen options={{ headerShown: false }} />
      <ListaAvisos
        comunicado_id={comunicado_id}
        abrir_inscricao={abrir_inscricao}
        topo={
          <View style={styles.header}>
            <Pressable onPress={() => subirUmNivel()} hitSlop={8} style={styles.back} accessibilityRole="button" accessibilityLabel={t("Voltar")}>
              <Ionicons name="chevron-back" size={24} color={colors.text} />
            </Pressable>
            <Text style={styles.title}>{t("Avisos")}</Text>
            <View style={{ width: 24 }} />
          </View>
        }
      />
    </SafeAreaView>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.xs },
    back: { width: 24 },
    title: { color: colors.text, fontSize: font.size.lg, fontWeight: "800" },
  });
