import { useEffect, useRef } from "react";
import { Animated, Pressable, type PressableProps, type ViewStyle } from "react-native";

/**
 * Atalho da home com:
 *  - Entrada escalonada (fade + leve "spring" pra cima), delay = index * 50ms.
 *  - Scale-press feedback (0.94 ao apertar, 1.0 ao soltar).
 */
export function AnimatedShortcut({
  index,
  children,
  style,
  ...rest
}: PressableProps & {
  index: number;
  children: React.ReactNode;
  style?: ViewStyle;
}) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(14)).current;
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 320,
        delay: index * 60,
        useNativeDriver: true,
      }),
      Animated.spring(translateY, {
        toValue: 0,
        delay: index * 60,
        useNativeDriver: true,
        stiffness: 180,
        damping: 16,
        mass: 0.6,
      }),
    ]).start();
  }, [index, opacity, translateY]);

  function onPressIn() {
    Animated.spring(scale, {
      toValue: 0.94,
      useNativeDriver: true,
      stiffness: 500,
      damping: 22,
      mass: 0.5,
    }).start();
  }
  function onPressOut() {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      stiffness: 400,
      damping: 14,
      mass: 0.4,
    }).start();
  }

  return (
    <Animated.View
      style={[
        style,
        { opacity, transform: [{ translateY }, { scale }] },
      ]}
    >
      <Pressable {...rest} onPressIn={onPressIn} onPressOut={onPressOut}>
        {children}
      </Pressable>
    </Animated.View>
  );
}
