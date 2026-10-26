import { Text } from "@/components/ui/Typography";
import { DockSurface } from "@/components/navigation/DockSurface";
import { Ionicons } from "@expo/vector-icons";
import { usePathname } from "expo-router";
import { Pressable, ScrollView, StyleSheet, useWindowDimensions } from "react-native";
import { useT } from "@/lib/i18n";
import { irParaBarra } from "@/lib/nav";
import { QUICK_LINKS } from "@/lib/appNavigation";
import { useTheme } from "@/contexts/ThemeContext";

export function QuickLinks() {
  const { width, fontScale } = useWindowDimensions();
  const { fontMultiplier } = useTheme();
  const scroll = width < 360 || fontScale * fontMultiplier > 1.2;
  const pathname = usePathname(), t = useT();
  return <DockSurface><ScrollView horizontal scrollEnabled={scroll} showsHorizontalScrollIndicator={false} style={styles.dock} contentContainerStyle={styles.content}>
    {QUICK_LINKS.map((item, i) => <Pressable key={item.href} accessibilityRole="button" accessibilityLabel={t(item.label)} accessibilityState={{ selected: pathname === item.href }} onPress={() => irParaBarra(pathname, item.href)} style={({ pressed }) => [styles.item, scroll ? { width: 120, flexBasis: 120, flexGrow: 0, flexShrink: 0 } : { flex: i === 4 ? 1.4 : 1 }, i > 0 && styles.divider, (pressed || pathname === item.href) && styles.selected]}>
      <Ionicons name={item.icon} size={21} color="#29434a" />
      <Text style={[styles.label, scroll && { fontSize: 12 }]}>{t(item.label)}</Text>
    </Pressable>)}
  </ScrollView></DockSurface>;
}
const styles = StyleSheet.create({
  dock: { flexGrow: 0, borderRadius: 28 },
  content: { flexGrow: 1, paddingVertical: 10, paddingHorizontal: 3 },
  item: { minHeight: 48, alignItems: "center", justifyContent: "center", paddingHorizontal: 2, gap: 7 },
  label: { fontSize: 10, fontWeight: "700", color: "#29434a", textAlign: "center", width: "100%" },
  divider: { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: "#c9d1cf" },
  selected: { backgroundColor: "#dfe9e7", borderRadius: 16 },
});
