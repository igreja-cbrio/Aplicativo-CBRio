import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
} from "react-native";
import { AntDesign } from "@expo/vector-icons";
import { colors, font, radius, spacing } from "@/constants/theme";

type Props = {
  provider: "google" | "apple";
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
};

const CONFIG = {
  google: { icon: "google" as const, label: "Continuar com Google" },
  apple: { icon: "apple1" as const, label: "Continuar com Apple" },
};

export function SocialButton({ provider, onPress, loading, disabled }: Props) {
  const { icon, label } = CONFIG[provider];
  const isDisabled = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      disabled={isDisabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        (pressed || isDisabled) && styles.dimmed,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={colors.text} />
      ) : (
        <>
          <AntDesign name={icon} size={18} color={colors.text} />
          <Text style={styles.label}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    height: 52,
    borderRadius: radius.full,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  dimmed: { opacity: 0.6 },
  label: { color: colors.text, fontSize: font.size.md, fontWeight: "600" },
});
