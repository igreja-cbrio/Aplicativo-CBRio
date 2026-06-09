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
      ? // teal escuro -> levemente mais frio embaixo
        ["#0A1B22", "#0E2630", "#0B1F26"]
      : // off-white -> tom de areia bem suave
        ["#F8F6F1", "#F0E9DD", "#FBFAF7"];
  return (
    <View
      pointerEvents="none"
      style={[StyleSheet.absoluteFillObject, { backgroundColor: colors.background }, style]}
    >
      <LinearGradient
        colors={stops as [string, string, string]}
        locations={[0, 0.55, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />
    </View>
  );
}
