import { ScrollView } from "@/components/navigation/DockContent";
import { Text } from "@/components/ui/Typography";
import { useMemo } from "react";
import { Image, Pressable, StyleSheet, View } from "react-native";
import { Stack } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useColors } from "@/contexts/ThemeContext";
import { useT } from "@/lib/i18n";
import { subirUmNivel } from "@/lib/hierarquia";
import { font, radius, spacing, type Palette } from "@/constants/theme";

// Créditos do app: a tela escondida atrás de "Configurações muito avançadas".
// Entrou no dia do lançamento pra igreja toda (25/11/2026).
const FOTO = require("../../assets/images/creditos-marcos-matheus.jpg");

export default function CreditosScreen() {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const t = useT();

  return (
    <SafeAreaView style={styles.safe} edges={["left", "right"]}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Pressable onPress={() => subirUmNivel()} hitSlop={8} style={styles.back}>
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </Pressable>
          <Text style={styles.title}>{t("Créditos do sistema")}</Text>
          <View style={{ width: 24 }} />
        </View>

        <Image
          source={FOTO}
          style={styles.foto}
          resizeMode="cover"
          accessibilityLabel={t("Marcos e Matheus, que fizeram o app")}
        />
      </ScrollView>
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
    // A foto é 3:4 (retrato); a proporção fixa evita salto de layout.
    foto: { width: "100%", aspectRatio: 3 / 4, borderRadius: radius.lg },
  });
