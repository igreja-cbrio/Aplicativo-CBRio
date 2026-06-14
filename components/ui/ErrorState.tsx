import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useColors } from "@/contexts/ThemeContext";
import { Button } from "@/components/ui/Button";
import { useT } from "@/lib/i18n";
import { font, spacing, type Palette } from "@/constants/theme";

/**
 * Estado de erro padrão (falha ao carregar). Mostra mensagem amigável e
 * botão "Tentar de novo". Usado no lugar de spinner infinito/alert.
 */
export function ErrorState({ onRetry, texto }: { onRetry?: () => void; texto?: string }) {
  const colors = useColors();
  const styles = makeStyles(colors);
  const t = useT();
  return (
    <View style={styles.wrap} accessibilityRole="text">
      <Ionicons name="cloud-offline-outline" size={34} color={colors.textMuted} />
      <Text style={styles.texto}>
        {texto ?? t("Não foi possível carregar. Verifique sua conexão.")}
      </Text>
      {onRetry && (
        <View style={{ marginTop: spacing.md }}>
          <Button title={t("Tentar de novo")} variant="ghost" onPress={onRetry} />
        </View>
      )}
    </View>
  );
}

function makeStyles(colors: Palette) {
  return StyleSheet.create({
    wrap: { alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 48, paddingHorizontal: spacing.lg },
    texto: { color: colors.textMuted, fontSize: font.size.sm, textAlign: "center", lineHeight: 20 },
  });
}
