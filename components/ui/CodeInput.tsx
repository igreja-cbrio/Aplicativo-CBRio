import { useEffect, useRef } from "react";
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { colors, font, radius } from "@/constants/theme";

type Props = {
  value: string;
  onChangeText: (value: string) => void;
  cellCount?: number;
  onFilled?: (code: string) => void;
  autoFocus?: boolean;
};

/**
 * Entrada de código (OTP) em células segmentadas com animação:
 * - cada célula dá um "pop" (scale) ao ser preenchida
 * - a célula em foco fica destacada com um caret piscando
 *
 * Inspirado no layout de verification-code (enzomanuelmangano/demos),
 * recriado com a API Animated nativa do React Native.
 */
export function CodeInput({
  value,
  onChangeText,
  cellCount = 6,
  onFilled,
  autoFocus = true,
}: Props) {
  const inputRef = useRef<TextInput>(null);

  function handleChange(text: string) {
    const digits = text.replace(/[^0-9]/g, "").slice(0, cellCount);
    onChangeText(digits);
    if (digits.length === cellCount) onFilled?.(digits);
  }

  return (
    <Pressable style={styles.row} onPress={() => inputRef.current?.focus()}>
      {Array.from({ length: cellCount }).map((_, i) => (
        <Cell
          key={i}
          digit={value[i] ?? ""}
          focused={i === value.length}
          filled={i < value.length}
        />
      ))}

      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={handleChange}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="sms-otp"
        maxLength={cellCount}
        autoFocus={autoFocus}
        style={styles.hiddenInput}
        caretHidden
      />
    </Pressable>
  );
}

function Cell({
  digit,
  focused,
  filled,
}: {
  digit: string;
  focused: boolean;
  filled: boolean;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const caret = useRef(new Animated.Value(0)).current;

  // "Pop" ao preencher a célula.
  useEffect(() => {
    if (digit) {
      scale.setValue(1.18);
      Animated.spring(scale, {
        toValue: 1,
        stiffness: 320,
        damping: 18,
        mass: 0.6,
        useNativeDriver: true,
      }).start();
    }
  }, [digit, scale]);

  // Caret piscando na célula em foco e vazia.
  useEffect(() => {
    if (focused && !digit) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(caret, {
            toValue: 1,
            duration: 500,
            easing: Easing.ease,
            useNativeDriver: true,
          }),
          Animated.timing(caret, {
            toValue: 0,
            duration: 500,
            easing: Easing.ease,
            useNativeDriver: true,
          }),
        ])
      );
      loop.start();
      return () => loop.stop();
    }
    caret.setValue(0);
  }, [focused, digit, caret]);

  return (
    <Animated.View
      style={[
        styles.cell,
        filled && styles.cellFilled,
        focused && styles.cellFocused,
        { transform: [{ scale }] },
      ]}
    >
      {digit ? (
        <Animated.Text style={styles.digit}>{digit}</Animated.Text>
      ) : (
        <Animated.View style={[styles.caret, { opacity: caret }]} />
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", justifyContent: "center", gap: 10 },
  cell: {
    width: 46,
    height: 56,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
    alignItems: "center",
    justifyContent: "center",
  },
  cellFilled: { borderColor: colors.brandMid },
  cellFocused: { borderColor: colors.primary, backgroundColor: colors.glass },
  digit: { color: colors.text, fontSize: font.size.xl, fontWeight: "700" },
  caret: {
    width: 2,
    height: 24,
    borderRadius: 1,
    backgroundColor: colors.primary,
  },
  hiddenInput: {
    position: "absolute",
    width: 1,
    height: 1,
    opacity: 0,
  },
});
