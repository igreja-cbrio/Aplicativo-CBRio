import { useMemo } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Text } from "@/components/ui/Typography";
import { Input } from "@/components/ui/Input";
import { useColors } from "@/contexts/ThemeContext";
import { font, radius, type Palette } from "@/constants/theme";
import type { CampoEvento } from "@/lib/api";

/** Campo extra do form-builder. Tipos que o app não sabe renderizar caem em texto. */
export function CampoExtra({
  campo,
  valor,
  onChange,
}: {
  campo: CampoEvento;
  valor: string;
  onChange: (v: string) => void;
}) {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const label = `${campo.label}${campo.obrigatorio ? " *" : ""}`;
  const opcoes = campo.opcoes || [];

  if ((campo.tipo === "select" || campo.tipo === "escolha") && opcoes.length) {
    return (
      <View style={styles.campoBloco}>
        <Text style={styles.campoLabel}>{label}</Text>
        <View style={styles.pills}>
          {opcoes.map((o) => {
            const sel = valor === o;
            return (
              <Pressable
                key={o}
                onPress={() => onChange(sel ? "" : o)}
                style={[styles.pill, sel && { backgroundColor: colors.primary, borderColor: colors.primary }]}
              >
                <Text style={[styles.pillTxt, sel && { color: "#fff" }]}>{o}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    );
  }

  if (campo.tipo === "multi" && opcoes.length) {
    // Múltipla escolha vai como lista separada por ", " — é o formato que o
    // servidor grava (string) e que o ERP exibe.
    const sel = new Set(valor ? valor.split(",").map((s) => s.trim()).filter(Boolean) : []);
    return (
      <View style={styles.campoBloco}>
        <Text style={styles.campoLabel}>{label}</Text>
        <View style={styles.pills}>
          {opcoes.map((o) => {
            const on = sel.has(o);
            return (
              <Pressable
                key={o}
                onPress={() => {
                  const n = new Set(sel);
                  if (on) n.delete(o);
                  else n.add(o);
                  onChange([...n].join(", "));
                }}
                style={[styles.pill, on && { backgroundColor: colors.primary, borderColor: colors.primary }]}
              >
                <Text style={[styles.pillTxt, on && { color: "#fff" }]}>{o}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    );
  }

  return (
    <Input
      label={label}
      value={valor}
      onChangeText={onChange}
      placeholder={campo.tipo === "data" ? "DD/MM/AAAA" : undefined}
      multiline={campo.tipo === "textarea"}
      keyboardType={
        campo.tipo === "numero" ? "number-pad" : campo.tipo === "email" ? "email-address" : "default"
      }
      autoCapitalize={campo.tipo === "email" ? "none" : "sentences"}
    />
  );
}

const makeStyles = (c: Palette) => StyleSheet.create({
    campoBloco: { gap: 6 },
    campoLabel: { color: c.text, fontSize: font.size.sm, fontWeight: "700" },
    pills: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    pill: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: radius.full,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.surfaceAlt,
    },
    pillTxt: { color: c.text, fontSize: 13, fontWeight: "600" },
});
