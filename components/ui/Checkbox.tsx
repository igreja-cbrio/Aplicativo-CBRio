import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useColors } from "@/contexts/ThemeContext";
import { font, radius, spacing, type Palette } from "@/constants/theme";

type Props = {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
};

export function Checkbox({ checked, onChange, label }: Props) {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <Pressable
      style={styles.row}
      onPress={() => onChange(!checked)}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      hitSlop={6}
    >
      <View style={[styles.box, checked && styles.boxChecked]}>
        {checked && <Ionicons name="checkmark" size={14} color="#fff" />}
      </View>
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    row: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    box: {
      width: 20,
      height: 20,
      borderRadius: radius.sm,
      borderWidth: 1.5,
      borderColor: colors.brandMid,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.glass,
    },
    boxChecked: { backgroundColor: colors.primary, borderColor: colors.primary },
    label: { color: colors.textMuted, fontSize: font.size.sm },
  });
