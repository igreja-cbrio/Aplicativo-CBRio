import { useEffect, useMemo, useRef } from "react";
import {
  Animated,
  Easing,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { BlurView } from "expo-blur";
import { GlassView, isLiquidGlassAvailable } from "expo-glass-effect";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/contexts/ThemeContext";
import { radius, spacing, type Palette } from "@/constants/theme";

const LIQUID = isLiquidGlassAvailable();

export type IconName = React.ComponentProps<typeof Ionicons>["name"];

export type DockItem = {
  key: string;
  label: string;
  icon: IconName;             // padrão (inativo, outline)
  iconActive?: IconName;      // variante preenchida quando ativo
  active: boolean;
  onPress: () => void;
};

/**
 * Dock flutuante com efeito "glass" (vidro fosco) recriado em React Native.
 * - blur real via expo-blur (BlurView)
 * - leve flutuação contínua (bob)
 * - ícone ativo destacado, anel de brilho e ponto indicador
 */
export function Dock({ items }: { items: DockItem[] }) {
  const { colors, mode } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const bob = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(bob, {
          toValue: -3,
          duration: 4000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(bob, {
          toValue: 0,
          duration: 4000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [bob]);

  return (
    <View
      pointerEvents="box-none"
      style={[styles.wrapper, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}
    >
      <Animated.View style={{ transform: [{ translateY: bob }] }}>
        {LIQUID ? (
          <GlassView
            glassEffectStyle="regular"
            isInteractive
            colorScheme={mode}
            style={styles.dock}
          >
            {items.map((item) => (
              <DockButton key={item.key} item={item} colors={colors} styles={styles} />
            ))}
          </GlassView>
        ) : (
          <BlurView
            intensity={40}
            tint={mode}
            experimentalBlurMethod={Platform.OS === "android" ? "dimezisBlurView" : undefined}
            style={[styles.dock, { backgroundColor: colors.dockBg }]}
          >
            {items.map((item) => (
              <DockButton key={item.key} item={item} colors={colors} styles={styles} />
            ))}
          </BlurView>
        )}
      </Animated.View>
    </View>
  );
}

function DockButton({
  item,
  colors,
  styles,
}: {
  item: DockItem;
  colors: Palette;
  styles: ReturnType<typeof makeStyles>;
}) {
  const scale = useRef(new Animated.Value(item.active ? 1 : 0.92)).current;

  useEffect(() => {
    Animated.spring(scale, {
      toValue: item.active ? 1.12 : 1,
      stiffness: 300,
      damping: 20,
      mass: 0.6,
      useNativeDriver: true,
    }).start();
  }, [item.active, scale]);

  return (
    <Pressable
      onPress={item.onPress}
      accessibilityRole="button"
      accessibilityLabel={item.label}
      accessibilityState={{ selected: item.active }}
      style={styles.item}
      hitSlop={6}
    >
      <Animated.View
        style={[
          styles.iconWrap,
          item.active && styles.iconWrapActive,
          { transform: [{ scale }] },
        ]}
      >
        <Ionicons
          name={item.active ? item.iconActive ?? item.icon : item.icon}
          size={26}
          color={item.active ? colors.brandPale : colors.textMuted}
        />
      </Animated.View>
      <View style={[styles.dot, item.active && styles.dotActive]} />
    </Pressable>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
  wrapper: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
  },
  dock: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.xl,
    borderWidth: LIQUID ? 0 : 1,
    borderColor: colors.glassBorder,
    overflow: "hidden",
  },
  item: { alignItems: "center", justifyContent: "center" },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: radius.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  iconWrapActive: {
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: "rgba(112,168,176,0.45)",
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 999,
    marginTop: 4,
    backgroundColor: "transparent",
  },
  dotActive: { backgroundColor: colors.brandPale },
});
