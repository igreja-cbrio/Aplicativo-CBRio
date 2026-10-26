import { StyleSheet, View, type ViewStyle } from "react-native";
import { useTheme } from "@/contexts/ThemeContext";
import { radius } from "@/constants/theme";

/** Superfície editorial compartilhada: contorno fino e cantos arredondados em iOS e Android. */
export function GlassCard({ children, style, clear = false }: {
  children: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
  /** Compatibilidade com chamadas existentes; o novo visual não usa blur. */
  intensity?: number;
  clear?: boolean;
}) {
  const { colors } = useTheme();
  return <View style={[{ borderRadius: radius.lg, overflow: "hidden", borderWidth: 1, borderColor: colors.border, backgroundColor: clear ? "transparent" : colors.surface }, StyleSheet.flatten(style)]}>{children}</View>;
}
