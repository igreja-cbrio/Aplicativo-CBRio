import { StyleSheet, View } from "react-native";
import { usePathname } from "expo-router";
import { Text } from "@/components/ui/Typography";
import { useColors } from "@/contexts/ThemeContext";
import { BRAND_FONT } from "@/lib/fonts";
import { valorDaRota } from "@/lib/valores";

/** Nome do valor da jornada no topo da tela (iBrand). Sem valor na rota: null. */
export function ValorHeader({ nome, style }: { nome?: string; style?: object }) {
  const colors = useColors(), pathname = usePathname();
  const texto = nome ?? valorDaRota(pathname)?.nome;
  if (!texto) return null;
  return <View style={[s.wrap, style]}>
    <Text accessibilityRole="header" style={[s.nome, { color: colors.primary }]}>{texto}</Text>
  </View>;
}
const s = StyleSheet.create({
  wrap: { marginBottom: 12 },
  nome: { fontFamily: BRAND_FONT, fontSize: 28, lineHeight: 34, letterSpacing: 0.3 },
});
