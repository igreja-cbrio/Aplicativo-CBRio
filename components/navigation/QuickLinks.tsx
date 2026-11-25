import { TutorialTarget, type TutorialTargetId } from "@/contexts/TutorialContext";
import { useCallback, useMemo, useRef } from "react";
import { Text } from "@/components/ui/Typography";
import { DockSurface } from "@/components/navigation/DockSurface";
import { NativeShortcuts } from "@/modules/native-shortcuts/src/NativeShortcuts";
import { Ionicons } from "@expo/vector-icons";
import { usePathname } from "expo-router";
import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from "react-native";
import { useT } from "@/lib/i18n";
import { irParaBarra } from "@/lib/nav";
import { QUICK_LINKS } from "@/lib/appNavigation";
import { useTheme } from "@/contexts/ThemeContext";

const TARGETS: TutorialTargetId[] = ["care", "devotional", "groups", "serve", "giving"];

export function QuickLinks() {
  const scrollRef = useRef<ScrollView>(null);
  const { width, fontScale } = useWindowDimensions();
  const { fontMultiplier } = useTheme();
  const scroll = width < 360 || fontScale * fontMultiplier > 1.2;
  const pathname = usePathname(), t = useT();
  const labels = useMemo(() => QUICK_LINKS.map(item => t(item.label)), [t]);
  // Só a versão que contém o controle UIKit usa a interação nativa. A OTA é
  // segura em binários antigos: nenhum gesto/lupa customizado é simulado.
  const reveal = useCallback((index: number) => { if (scroll) scrollRef.current?.scrollTo({ x: Math.max(0, index * 120 - 12), animated: false }); }, [scroll]);
  if (NativeShortcuts && !scroll) return <TutorialTarget id="dock"><NativeShortcuts
    labels={labels}
    selectedIndex={QUICK_LINKS.findIndex(item => pathname === item.href)}
    style={{ height: 74, width: "100%" }}
    onShortcutSelect={({ nativeEvent }) => {
      const item = QUICK_LINKS[nativeEvent.index];
      if (item) irParaBarra(pathname, item.href);
    }}
  /></TutorialTarget>;
  // UITabBar já aplica o próprio recuo. Só o fallback precisa dessa margem.
  return <View style={styles.fallbackMargin}><DockSurface><ScrollView ref={scrollRef} horizontal scrollEnabled={scroll} showsHorizontalScrollIndicator={false} style={styles.dock} contentContainerStyle={styles.content}>
    {QUICK_LINKS.map((item, i) => <QuickLinkTarget key={item.href} id={TARGETS[i]} index={i} reveal={reveal} style={scroll ? { width: 120, flexBasis: 120, flexGrow: 0, flexShrink: 0 } : { flex: i === 4 ? 1.4 : 1 }}>
      <Pressable accessibilityRole="button" accessibilityLabel={labels[i]} accessibilityState={{ selected: pathname === item.href }} onPress={() => irParaBarra(pathname, item.href)} style={({ pressed }) => [styles.item, i > 0 && styles.divider, (pressed || pathname === item.href) && styles.selected]}>
        <Ionicons name={item.icon} size={21} color="#29434a" />
        <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={[styles.label, scroll && { fontSize: 12 }]}>{labels[i]}</Text>
      </Pressable>
    </QuickLinkTarget>)}
  </ScrollView></DockSurface></View>;
}
function QuickLinkTarget({ id, index, reveal, ...props }: Omit<React.ComponentProps<typeof TutorialTarget>, "reveal"> & { index: number; reveal: (index: number) => void }) {
  const show = useCallback(() => reveal(index), [reveal, index]);
  return <TutorialTarget {...props} id={id} reveal={show} />;
}
const styles = StyleSheet.create({
  fallbackMargin: { paddingHorizontal: 20 },
  dock: { flexGrow: 0, borderRadius: 28 },
  content: { flexGrow: 1, paddingVertical: 10, paddingHorizontal: 3 },
  item: { minHeight: 48, alignItems: "center", justifyContent: "center", paddingHorizontal: 2, gap: 7 },
  label: { fontSize: 10, fontWeight: "700", color: "#29434a", textAlign: "center", width: "100%" },
  divider: { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: "#c9d1cf" },
  selected: { backgroundColor: "#dfe9e7", borderRadius: 16 },
});
