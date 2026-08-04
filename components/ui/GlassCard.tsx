import { Platform, StyleSheet, View, type ViewStyle } from "react-native";
import { BlurView } from "expo-blur";
import { GlassView, isLiquidGlassAvailable } from "expo-glass-effect";
import { useTheme } from "@/contexts/ThemeContext";
import { radius } from "@/constants/theme";

const LIQUID = isLiquidGlassAvailable();

/**
 * Card com Liquid Glass (iOS 26) -> BlurView (iOS <26 / Android) ->
 * surface sólida (web). Refração e profundidade próximas do padrão
 * Apple. Use no lugar de View+backgroundColor em cards principais.
 */
export function GlassCard({
  children,
  style,
  intensity = 40,
  clear = false,
}: {
  children: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
  intensity?: number;
  /** clear=true usa o estilo mais translúcido (sem fundo difuso). */
  clear?: boolean;
}) {
  const { colors, mode } = useTheme();
  const baseStyle: ViewStyle = {
    borderRadius: radius.lg,
    overflow: "hidden",
    borderWidth: LIQUID ? 0 : 1,
    borderColor: colors.glassBorder,
  };

  if (LIQUID) {
    return (
      <GlassView
        glassEffectStyle={clear ? "clear" : "regular"}
        colorScheme={mode}
        style={[baseStyle, style]}
      >
        {children}
      </GlassView>
    );
  }

  if (Platform.OS === "ios") {
    return (
      <BlurView
        intensity={intensity}
        tint={mode}
        style={[baseStyle, { backgroundColor: colors.surface }, style]}
      >
        {children}
      </BlurView>
    );
  }

  // ANDROID (e web): superfície sólida translúcida, SEM BlurView.
  // ⚠️ NÃO voltar ao `experimentalBlurMethod="dimezisBlurView"`: o blur
  // experimental do expo-blur crasha NATIVO no Android — "o app foi fechado
  // forçadamente" ao rolar a Home (ProximosCultos) e ao abrir a aba Menu
  // (a lista inteira vive num GlassCard) — reproduzido em Xiaomi/MIUI
  // (Marcos · 04/08/2026). O borrão no Android não vale um crash.
  return (
    <View
      style={[
        baseStyle,
        { backgroundColor: colors.surface, ...StyleSheet.flatten(style) },
      ]}
    >
      {children}
    </View>
  );
}
