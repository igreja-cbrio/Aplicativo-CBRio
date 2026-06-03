import { useMemo } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  type PressableProps,
} from "react-native";
import { useColors } from "@/contexts/ThemeContext";
import { font, radius, spacing, type Palette } from "@/constants/theme";

type Props = PressableProps & {
  title: string;
  loading?: boolean;
  variant?: "primary" | "ghost";
};

export function Button({
  title,
  loading,
  variant = "primary",
  disabled,
  ...rest
}: Props) {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const isDisabled = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        variant === "primary" ? styles.primary : styles.ghost,
        (pressed || isDisabled) && styles.dimmed,
      ]}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={variant === "ghost" ? colors.primary : "#fff"} />
      ) : (
        <Text
          style={[
            styles.label,
            variant === "ghost" && { color: colors.primary },
          ]}
        >
          {title}
        </Text>
      )}
    </Pressable>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    base: {
      height: 52,
      borderRadius: radius.full,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: spacing.lg,
    },
    primary: { backgroundColor: colors.primary },
    ghost: { backgroundColor: "transparent" },
    dimmed: { opacity: 0.6 },
    label: { color: "#fff", fontSize: font.size.md, fontWeight: "600" },
  });
