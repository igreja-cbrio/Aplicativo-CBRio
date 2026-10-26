import { StyleSheet, View, type ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "@/contexts/ThemeContext";

/**
 * Fundo da tela com gradiente sutil — top-bottom, alinhado às cores
 * da marca. Não sobrepõe nada (pointerEvents none) e preserva
 * contraste de leitura no claro e no escuro.
 */
export function ScreenBackground({ style }: { style?: ViewStyle }) {
  const { colors, mode } = useTheme();
  const stops =
    mode === "dark"
      ? // brilho teal no topo -> base escura da marca
        ["#314b51", "#29434a", "#233c42"]
      : // azul claro da marca -> areia suave (gradiente perceptível, texto escuro ok)
        ["#e6ece8", "#f2f3ef", "#fafaf6"];
  return (
    <View
      pointerEvents="none"
      style={[StyleSheet.absoluteFillObject, { backgroundColor: colors.background }, style]}
    >
      <LinearGradient
        colors={stops as [string, string, string]}
        locations={[0, 0.45, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.35, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />
    </View>
  );
}
