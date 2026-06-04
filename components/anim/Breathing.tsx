import { useEffect, useRef } from "react";
import { Animated, Easing, type ViewStyle } from "react-native";

/** Wrapper que dá um "breathe" sutil (scale 1.00 <-> 1.012, 4s ciclo). */
export function Breathing({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
}) {
  const s = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(s, {
          toValue: 1.012,
          duration: 2000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(s, {
          toValue: 1,
          duration: 2000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [s]);
  return <Animated.View style={[style, { transform: [{ scale: s }] }]}>{children}</Animated.View>;
}
