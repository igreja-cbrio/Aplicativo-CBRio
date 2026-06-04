import { useEffect, useRef } from "react";
import { Animated, StyleSheet, View, type ViewStyle } from "react-native";
import { useColors } from "@/contexts/ThemeContext";

/** Skeleton com efeito shimmer (gradiente animado). Substitui ActivityIndicator. */
export function Skeleton({
  width,
  height,
  borderRadius = 8,
  style,
}: {
  width?: number | `${number}%`;
  height: number;
  borderRadius?: number;
  style?: ViewStyle;
}) {
  const colors = useColors();
  const shimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(shimmer, {
        toValue: 1,
        duration: 1300,
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [shimmer]);

  const translateX = shimmer.interpolate({
    inputRange: [0, 1],
    outputRange: [-200, 400],
  });

  return (
    <View
      style={[
        styles.base,
        { width: width as ViewStyle["width"], height, borderRadius, backgroundColor: colors.surface },
        style,
      ]}
    >
      <Animated.View
        style={[
          styles.shimmer,
          {
            transform: [{ translateX }],
            backgroundColor: colors.glass,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  base: { overflow: "hidden" },
  shimmer: { position: "absolute", top: 0, bottom: 0, width: 180, opacity: 0.6 },
});
