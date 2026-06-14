import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useColors } from "@/contexts/ThemeContext";
import { Button } from "@/components/ui/Button";
import { font, spacing, type Palette } from "@/constants/theme";

/**
 * Estado vazio padrão (lista sem itens). Ícone + título + texto opcional
 * e ação opcional. Usado no lugar de telas em branco.
 */
export function EmptyState({
  icon = "sparkles-outline",
  titulo,
  texto,
  acao,
}: {
  icon?: React.ComponentProps<typeof Ionicons>["name"];
  titulo: string;
  texto?: string;
  acao?: { label: string; onPress: () => void };
}) {
  const colors = useColors();
  const styles = makeStyles(colors);
  return (
    <View style={styles.wrap} accessibilityRole="text">
      <Ionicons name={icon} size={34} color={colors.textMuted} />
      <Text style={styles.titulo}>{titulo}</Text>
      {!!texto && <Text style={styles.texto}>{texto}</Text>}
      {acao && (
        <View style={{ marginTop: spacing.md }}>
          <Button title={acao.label} variant="ghost" onPress={acao.onPress} />
        </View>
      )}
    </View>
  );
}

function makeStyles(colors: Palette) {
  return StyleSheet.create({
    wrap: { alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 48, paddingHorizontal: spacing.lg },
    titulo: { color: colors.text, fontSize: font.size.md, fontWeight: "700", textAlign: "center" },
    texto: { color: colors.textMuted, fontSize: font.size.sm, textAlign: "center", lineHeight: 20 },
  });
}
