import { useRef } from "react";
import { Animated, Pressable, type PressableProps, type ViewStyle } from "react-native";

/** Card que "levanta" no press (scale animado, shadow estático). */
export function AnimatedCard({
  children,
  style,
  ...rest
}: PressableProps & { children: React.ReactNode; style?: ViewStyle }) {
  const scale = useRef(new Animated.Value(1)).current;

  function onPressIn() {
    Animated.spring(scale, {
      toValue: 1.03,
      useNativeDriver: true,
      stiffness: 400,
      damping: 18,
      mass: 0.5,
    }).start();
  }
  function onPressOut() {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      stiffness: 320,
      damping: 16,
      mass: 0.5,
    }).start();
  }

  return (
    <Animated.View
      style={[
        style,
        {
          transform: [{ scale }],
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.15,
          shadowRadius: 10,
        },
      ]}
    >
      <Pressable {...rest} onPressIn={onPressIn} onPressOut={onPressOut}>
        {children}
      </Pressable>
    </Animated.View>
  );
}
