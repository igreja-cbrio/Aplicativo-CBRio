import { DockInsetContext } from "@/components/navigation/DockContent";
import { Text } from "@/components/ui/Typography";
import { useContext, useMemo, useState } from "react";
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
const FOTO = require("../../../assets/images/creditos-marcos-matheus.jpg");
// Proporção real do arquivo (1200×1599). A foto aparece INTEIRA, sem rolagem:
// o tamanho sai do espaço que sobrou na tela, nunca o contrário.
const PROPORCAO = 1200 / 1599;

export default function CreditosScreen() {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const t = useT();
  // Sem ScrollView, é a tela que reserva o espaço da barra de baixo.
  const dock = useContext(DockInsetContext);
  const [area, setArea] = useState<{ w: number; h: number } | null>(null);

  // Maior retângulo na proporção da foto que cabe na área livre.
  const largura = area ? Math.min(area.w, area.h * PROPORCAO) : 0;
  const altura = largura / PROPORCAO;

  return (
    <SafeAreaView style={styles.safe} edges={["left", "right"]}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.content, { paddingBottom: spacing.lg + dock }]}>
        <View style={styles.header}>
          <Pressable onPress={() => subirUmNivel()} hitSlop={8} style={styles.back}>
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </Pressable>
          <Text style={styles.title}>{t("Créditos do sistema")}</Text>
          <View style={{ width: 24 }} />
        </View>

        <View
          style={styles.area}
          onLayout={(e) => setArea({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
        >
          {area && largura > 0 && (
            <Image
              source={FOTO}
              style={{ width: largura, height: altura, borderRadius: radius.lg }}
              resizeMode="cover"
              accessibilityLabel={t("Marcos e Matheus, que fizeram o app")}
            />
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    content: { flex: 1, padding: spacing.lg, gap: spacing.lg },
    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    back: { width: 24 },
    title: { color: colors.text, fontSize: font.size.lg, fontWeight: "800" },
    area: { flex: 1, alignItems: "center", justifyContent: "center" },
  });
