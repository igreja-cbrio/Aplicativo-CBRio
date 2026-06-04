import { useEffect, useRef, useState } from "react";
import { Animated, StyleSheet, Text, type TextStyle, View } from "react-native";

/**
 * Número grande com tick de "flip" quando o valor muda (ex.: contagem
 * regressiva diária do batismo). Sobe o número antigo, desce o novo.
 */
export function AnimatedCountdown({
  value,
  style,
}: {
  value: string | number;
  style?: TextStyle;
}) {
  const [display, setDisplay] = useState(String(value));
  const [prev, setPrev] = useState<string | null>(null);
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const next = String(value);
    if (next === display) return;
    setPrev(display);
    setDisplay(next);
    anim.setValue(0);
    Animated.spring(anim, {
      toValue: 1,
      useNativeDriver: true,
      stiffness: 220,
      damping: 22,
      mass: 0.7,
    }).start(() => setPrev(null));
  }, [value, display, anim]);

  const ySaindo = anim.interpolate({ inputRange: [0, 1], outputRange: [0, -40] });
  const yEntrando = anim.interpolate({ inputRange: [0, 1], outputRange: [40, 0] });
  const opSaindo = anim.interpolate({ inputRange: [0, 1], outputRange: [1, 0] });
  const opEntrando = anim.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });

  if (!prev) {
    return <Text style={style}>{display}</Text>;
  }

  return (
    <View style={styles.wrap}>
      <Animated.Text
        style={[style, styles.layer, { transform: [{ translateY: ySaindo }], opacity: opSaindo }]}
      >
        {prev}
      </Animated.Text>
      <Animated.Text
        style={[style, { transform: [{ translateY: yEntrando }], opacity: opEntrando }]}
      >
        {display}
      </Animated.Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { overflow: "hidden" },
  layer: { position: "absolute", top: 0, left: 0 },
});
