import { useEffect, useRef } from "react";
import { Animated, Easing, type ViewStyle } from "react-native";

/** Balanço do sino quando o contador de não-lidas aumenta. */
export function AnimatedBell({
  count,
  children,
  style,
}: {
  count: number;
  children: React.ReactNode;
  style?: ViewStyle;
}) {
  const rot = useRef(new Animated.Value(0)).current;
  const last = useRef(count);

  useEffect(() => {
    if (count > last.current) {
      Animated.sequence([
        Animated.timing(rot, { toValue: 1, duration: 80, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(rot, { toValue: -1, duration: 130, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }),
        Animated.timing(rot, { toValue: 0.6, duration: 130, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }),
        Animated.timing(rot, { toValue: -0.3, duration: 110, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }),
        Animated.timing(rot, { toValue: 0, duration: 90, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]).start();
    }
    last.current = count;
  }, [count, rot]);

  const rotate = rot.interpolate({ inputRange: [-1, 1], outputRange: ["-18deg", "18deg"] });

  return (
    <Animated.View style={[style, { transform: [{ rotate }] }]}>{children}</Animated.View>
  );
}
