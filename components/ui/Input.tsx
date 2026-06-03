import { useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from "react-native";
import { colors, font, radius, spacing } from "@/constants/theme";

type Props = TextInputProps & {
  label: string;
  secure?: boolean;
};

export function Input({ label, secure, ...rest }: Props) {
  const [hidden, setHidden] = useState(!!secure);

  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.field}>
        <TextInput
          style={styles.input}
          placeholderTextColor={colors.textMuted}
          secureTextEntry={hidden}
          autoCapitalize="none"
          {...rest}
        />
        {secure && (
          <Pressable onPress={() => setHidden((v) => !v)} hitSlop={8}>
            <Text style={styles.toggle}>{hidden ? "Mostrar" : "Ocultar"}</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: spacing.xs,
  },
  label: {
    color: colors.textMuted,
    fontSize: font.size.sm,
    fontWeight: "600",
  },
  field: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
  },
  input: {
    flex: 1,
    height: 52,
    color: colors.text,
    fontSize: font.size.md,
  },
  toggle: {
    color: colors.primary,
    fontSize: font.size.sm,
    fontWeight: "600",
  },
});
