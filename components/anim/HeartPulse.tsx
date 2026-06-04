import { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";
import { CbrioHeart } from "@/components/brand/CbrioHeart";
import { useColors } from "@/contexts/ThemeContext";

/** Coração CBRio pulsando — usado no pull-to-refresh e em loaders de marca. */
export function HeartPulse({ size = 28, visible = true }: { size?: number; visible?: boolean }) {
  const colors = useColors();
  const pulse = useRef(new Animated.Value(0)).current;
  const fade = useRef(new Animated.Value(visible ? 1 : 0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 600,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 600,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }),
      ])
    );
    if (visible) loop.start();
    return () => loop.stop();
  }, [pulse, visible]);

  useEffect(() => {
    Animated.timing(fade, {
      toValue: visible ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [fade, visible]);

  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.18] });
  const halo = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.25, 0] });
  const haloScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 2.0] });

  return (
    <Animated.View style={[styles.wrap, { opacity: fade }]} pointerEvents="none">
      <Animated.View
        style={[
          styles.halo,
          {
            width: size * 1.4,
            height: size * 1.4,
            borderRadius: (size * 1.4) / 2,
            backgroundColor: colors.primary,
            opacity: halo,
            transform: [{ scale: haloScale }],
          },
        ]}
      />
      <Animated.View style={{ transform: [{ scale }] }}>
        <CbrioHeart size={size} color={colors.primary} />
      </Animated.View>
    </Animated.View>
  );
}

/** Overlay fixo no topo da tela com o coração pulsando — pra pull-to-refresh. */
export function HeartPulseOverlay({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return (
    <View style={styles.overlay} pointerEvents="none">
      <HeartPulse size={32} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", justifyContent: "center" },
  halo: { position: "absolute" },
  overlay: {
    position: "absolute",
    top: 60,
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 100,
  },
});
