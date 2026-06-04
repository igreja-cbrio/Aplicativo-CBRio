import { useRef } from "react";
import { Animated, Pressable, type PressableProps, type ViewStyle } from "react-native";

/** Card que "levanta" no press (scale + shadow). */
export function AnimatedCard({
  children,
  style,
  ...rest
}: PressableProps & { children: React.ReactNode; style?: ViewStyle }) {
  const scale = useRef(new Animated.Value(1)).current;
  const elev = useRef(new Animated.Value(0)).current;

  function onPressIn() {
    Animated.parallel([
      Animated.spring(scale, { toValue: 1.025, useNativeDriver: true, stiffness: 400, damping: 18, mass: 0.5 }),
      Animated.timing(elev, { toValue: 1, duration: 140, useNativeDriver: false }),
    ]).start();
  }
  function onPressOut() {
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, stiffness: 320, damping: 16, mass: 0.5 }),
      Animated.timing(elev, { toValue: 0, duration: 160, useNativeDriver: false }),
    ]).start();
  }

  const shadowOpacity = elev.interpolate({ inputRange: [0, 1], outputRange: [0.08, 0.22] });
  const shadowRadius = elev.interpolate({ inputRange: [0, 1], outputRange: [4, 14] });

  return (
    <Animated.View
      style={[
        style,
        {
          transform: [{ scale }],
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity,
          shadowRadius,
        },
      ]}
    >
      <Pressable {...rest} onPressIn={onPressIn} onPressOut={onPressOut}>
        {children}
      </Pressable>
    </Animated.View>
  );
}
