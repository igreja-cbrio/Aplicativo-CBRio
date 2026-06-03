import { useMemo, useState } from "react";
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { COUNTRIES, flagEmoji, type Country } from "@/constants/countries";
import { onlyDigits } from "@/lib/validators";
import { useColors } from "@/contexts/ThemeContext";
import { font, radius, spacing, type Palette } from "@/constants/theme";

type Props = {
  label: string;
  country: Country;
  onChangeCountry: (c: Country) => void;
  number: string;
  onChangeNumber: (v: string) => void;
};

export function PhoneInput({
  label,
  country,
  onChangeCountry,
  number,
  onChangeNumber,
}: Props) {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const data = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return COUNTRIES;
    return COUNTRIES.filter(
      (c) => c.name.toLowerCase().includes(q) || c.dial.includes(q)
    );
  }, [query]);

  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.row}>
        <Pressable style={styles.country} onPress={() => setOpen(true)}>
          <Text style={styles.flag}>{flagEmoji(country.iso2)}</Text>
          <Text style={styles.dial}>+{country.dial}</Text>
          <Text style={styles.caret}>▾</Text>
        </Pressable>
        <TextInput
          style={styles.input}
          value={number}
          onChangeText={(t) => onChangeNumber(onlyDigits(t))}
          placeholder="DDD + número"
          placeholderTextColor={colors.textMuted}
          keyboardType="phone-pad"
        />
      </View>

      <Modal
        visible={open}
        animationType="slide"
        transparent
        onRequestClose={() => setOpen(false)}
      >
        <View style={styles.backdrop}>
          <SafeAreaView style={styles.sheet} edges={["bottom"]}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Escolha o país</Text>
              <Pressable onPress={() => setOpen(false)} hitSlop={8}>
                <Text style={styles.close}>Fechar</Text>
              </Pressable>
            </View>
            <TextInput
              style={styles.search}
              value={query}
              onChangeText={setQuery}
              placeholder="Buscar país ou código"
              placeholderTextColor={colors.textMuted}
              autoCorrect={false}
              autoCapitalize="none"
            />
            <FlatList
              data={data}
              keyExtractor={(c) => c.iso2}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <Pressable
                  style={styles.itemRow}
                  onPress={() => {
                    onChangeCountry(item);
                    setOpen(false);
                    setQuery("");
                  }}
                >
                  <Text style={styles.flag}>{flagEmoji(item.iso2)}</Text>
                  <Text style={styles.itemName}>{item.name}</Text>
                  <Text style={styles.itemDial}>+{item.dial}</Text>
                </Pressable>
              )}
            />
          </SafeAreaView>
        </View>
      </Modal>
    </View>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
  wrapper: { gap: spacing.xs },
  label: { color: colors.textMuted, fontSize: font.size.sm, fontWeight: "600" },
  row: { flexDirection: "row", gap: spacing.sm },
  country: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    height: 52,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  flag: { fontSize: 20 },
  dial: { color: colors.text, fontSize: font.size.md, fontWeight: "600" },
  caret: { color: colors.textMuted, fontSize: 12 },
  input: {
    flex: 1,
    height: 52,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    fontSize: font.size.md,
  },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  sheet: {
    maxHeight: "75%",
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.md,
  },
  sheetTitle: { color: colors.text, fontSize: font.size.lg, fontWeight: "800" },
  close: { color: colors.brandMid, fontSize: font.size.md, fontWeight: "700" },
  search: {
    height: 48,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    fontSize: font.size.md,
    marginBottom: spacing.sm,
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  itemName: { flex: 1, color: colors.text, fontSize: font.size.md },
  itemDial: { color: colors.textMuted, fontSize: font.size.md },
});
