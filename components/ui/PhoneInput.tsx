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
import {
  digitosTelefone,
  exibirTelefone,
  MAX_DIGITOS_INTERNACIONAL,
} from "@/lib/telefone";
import { useColors } from "@/contexts/ThemeContext";
import { useT } from "@/lib/i18n";
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
  const t = useT();
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
        {/*
          ⚠️ O `value` é a MÁSCARA e o estado do pai continua sendo só DÍGITOS
          (07/08/2026). Guardar a máscara quebraria quem concatena `+55` +
          número na hora de gravar. `maxLength` é do texto EXIBIDO (com
          parênteses e hífen), por isso 15 no BR pra caber `(21) 99999-8888` —
          quem corta os dígitos de verdade é `digitosTelefone`.
        */}
        <TextInput
          style={styles.input}
          value={exibirTelefone(number, country.dial)}
          onChangeText={(v) => onChangeNumber(digitosTelefone(v, country.dial))}
          placeholder={country.dial === "55" ? "(21) 99999-8888" : t("DDD + número")}
          placeholderTextColor={colors.textMuted}
          keyboardType="phone-pad"
          maxLength={country.dial === "55" ? 15 : MAX_DIGITOS_INTERNACIONAL}
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
              <Text style={styles.sheetTitle}>{t("Escolha o país")}</Text>
              <Pressable onPress={() => setOpen(false)} hitSlop={8}>
                <Text style={styles.close}>{t("Fechar")}</Text>
              </Pressable>
            </View>
            <TextInput
              style={styles.search}
              value={query}
              onChangeText={setQuery}
              placeholder={t("Buscar país ou código")}
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
