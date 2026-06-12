import { useEffect, useMemo, useRef } from "react";
import {
  Animated as RNAnimated,
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
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  type SharedValue,
  Easing as ReEasing,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { useTheme } from "@/contexts/ThemeContext";
import { radius, spacing, type Palette } from "@/constants/theme";

const LIQUID = isLiquidGlassAvailable();
const LENS = 52; // diâmetro da lente de vidro

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
 * - blur real via expo-blur (BlurView) / Liquid Glass no iOS 26+
 * - leve flutuação contínua (bob)
 * - ícone ativo destacado, anel de brilho e ponto indicador
 * - LENTE ARRASTÁVEL (estilo tab bar do iOS 26): segure o dedo no dock e
 *   uma lente de vidro surge sob ele; arraste entre os módulos — os ícones
 *   se magnificam conforme a lente se aproxima — e solte pra navegar.
 */
export function Dock({ items }: { items: DockItem[] }) {
  const { colors, mode } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const bob = useRef(new RNAnimated.Value(0)).current;

  // ── lente arrastável ──
  const lensX = useSharedValue(0);        // centro da lente (coord. do dock)
  const lensAtiva = useSharedValue(0);    // 0..1 (entrada/saída animada)
  const centros = useSharedValue<number[]>([]); // centro x de cada item
  const hover = useSharedValue(-1);       // índice sob a lente

  function aoLayoutItem(index: number, x: number, width: number) {
    const arr = centros.value.slice();
    arr[index] = x + width / 2;
    centros.value = arr;
  }

  function selecionar(index: number) {
    const item = items[index];
    if (item) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      item.onPress();
    }
  }

  function hapticLeve() {
    Haptics.selectionAsync();
  }

  function hapticInicio() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid);
  }

  const arrasto = Gesture.Pan()
    .activateAfterLongPress(220)
    .maxPointers(1)
    .onStart((e) => {
      lensX.value = e.x;
      lensAtiva.value = withSpring(1, { stiffness: 320, damping: 22 });
      runOnJS(hapticInicio)();
    })
    .onUpdate((e) => {
      const c = centros.value;
      if (!c.length) return;
      const min = c[0];
      const max = c[c.length - 1];
      lensX.value = Math.min(Math.max(e.x, min), max);
      // índice mais próximo do dedo
      let idx = 0;
      let menor = Number.MAX_VALUE;
      for (let i = 0; i < c.length; i++) {
        const d = Math.abs(lensX.value - c[i]);
        if (d < menor) { menor = d; idx = i; }
      }
      if (idx !== hover.value) {
        hover.value = idx;
        runOnJS(hapticLeve)();
      }
    })
    .onEnd(() => {
      const idx = hover.value;
      lensAtiva.value = withTiming(0, { duration: 180, easing: ReEasing.out(ReEasing.quad) });
      hover.value = -1;
      if (idx >= 0) runOnJS(selecionar)(idx);
    })
    .onFinalize(() => {
      if (lensAtiva.value !== 0) {
        lensAtiva.value = withTiming(0, { duration: 180 });
        hover.value = -1;
      }
    });

  const estiloLente = useAnimatedStyle(() => ({
    opacity: lensAtiva.value,
    transform: [
      { translateX: lensX.value - LENS / 2 },
      { translateY: interpolate(lensAtiva.value, [0, 1], [8, -6]) },
      { scale: interpolate(lensAtiva.value, [0, 1], [0.5, 1.15]) },
    ],
  }));

  useEffect(() => {
    const loop = RNAnimated.loop(
      RNAnimated.sequence([
        RNAnimated.timing(bob, {
          toValue: -3,
          duration: 4000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        RNAnimated.timing(bob, {
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

  // ⚠️ Nada de GlassView aqui: GlassView aninhada dentro da GlassView do
  // dock quebra a renderização dos filhos (ícones somem). A lente é uma
  // camada translúcida simples — visualmente "vidro" o suficiente.
  const lente = (
    <Animated.View pointerEvents="none" style={[styles.lente, estiloLente]}>
      <View
        style={[
          styles.lenteVidro,
          { backgroundColor: mode === "dark" ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.55)" },
        ]}
      />
    </Animated.View>
  );

  const botoes = items.map((item, i) => (
    <DockButton
      key={item.key}
      item={item}
      index={i}
      lensX={lensX}
      lensAtiva={lensAtiva}
      centros={centros}
      onLayoutItem={aoLayoutItem}
      colors={colors}
      styles={styles}
    />
  ));

  return (
    <View
      pointerEvents="box-none"
      style={[styles.wrapper, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}
    >
      <RNAnimated.View style={{ transform: [{ translateY: bob }] }}>
        <GestureDetector gesture={arrasto}>
          {LIQUID ? (
            <GlassView
              glassEffectStyle="regular"
              isInteractive
              colorScheme={mode}
              style={styles.dock}
            >
              {lente}
              {botoes}
            </GlassView>
          ) : (
            <BlurView
              intensity={40}
              tint={mode}
              experimentalBlurMethod={Platform.OS === "android" ? "dimezisBlurView" : undefined}
              style={[styles.dock, { backgroundColor: colors.dockBg }]}
            >
              {lente}
              {botoes}
            </BlurView>
          )}
        </GestureDetector>
      </RNAnimated.View>
    </View>
  );
}

function DockButton({
  item,
  index,
  lensX,
  lensAtiva,
  centros,
  onLayoutItem,
  colors,
  styles,
}: {
  item: DockItem;
  index: number;
  lensX: SharedValue<number>;
  lensAtiva: SharedValue<number>;
  centros: SharedValue<number[]>;
  onLayoutItem: (index: number, x: number, width: number) => void;
  colors: Palette;
  styles: ReturnType<typeof makeStyles>;
}) {
  const baseScale = useSharedValue(item.active ? 1.12 : 1);

  useEffect(() => {
    baseScale.value = withSpring(item.active ? 1.12 : 1, {
      stiffness: 300,
      damping: 20,
      mass: 0.6,
    });
  }, [item.active, baseScale]);

  // Magnificação: quanto mais perto a lente, maior o ícone (e levita um pouco)
  const estilo = useAnimatedStyle(() => {
    const cx = centros.value[index] ?? -9999;
    const dist = Math.abs(lensX.value - cx);
    const boost = lensAtiva.value * interpolate(dist, [0, 34, 90], [0.3, 0.12, 0], "clamp");
    return {
      transform: [
        { scale: baseScale.value + boost },
        { translateY: -boost * 26 },
      ],
    };
  });

  return (
    <Pressable
      onPress={item.onPress}
      onLayout={(e) => onLayoutItem(index, e.nativeEvent.layout.x, e.nativeEvent.layout.width)}
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
          estilo,
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
    overflow: "visible",
  },
  lente: {
    position: "absolute",
    left: 0,
    top: spacing.sm + 2,
    width: LENS,
    height: LENS,
    zIndex: 1,
  },
  lenteVidro: {
    flex: 1,
    borderRadius: LENS / 2,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.35)",
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
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
