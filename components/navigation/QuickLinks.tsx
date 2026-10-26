import { useEffect, useMemo, useRef, useState } from "react";
import * as Haptics from "expo-haptics";
import { Text } from "@/components/ui/Typography";
import { DockSurface } from "@/components/navigation/DockSurface";
import { Ionicons } from "@expo/vector-icons";
import { usePathname } from "expo-router";
import { AccessibilityInfo, Animated, PanResponder, Platform, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from "react-native";
import { useT } from "@/lib/i18n";
import { irParaBarra } from "@/lib/nav";
import { QUICK_LINKS } from "@/lib/appNavigation";
import { useTheme } from "@/contexts/ThemeContext";

export function QuickLinks() {
  const { width, fontScale } = useWindowDimensions();
  const { fontMultiplier } = useTheme();
  const scroll = width < 360 || fontScale * fontMultiplier > 1.2;
  const pathname = usePathname(), t = useT();
  const frame = useRef<View>(null);
  const bounds = useRef({ x: 0, y: 0, width: 0, height: 0 });
  const items = useRef<{ x: number; width: number }[]>([]);
  const offset = useRef(0);
  const held = useRef(false), selected = useRef<number | null>(null);
  const lensX = useRef(new Animated.Value(0)).current;
  const reduceMotion = useRef(true);
  const [lens, setLens] = useState<number | null>(null);
  const [screenReader, setScreenReader] = useState(false);
  const navigate = useRef((index: number) => irParaBarra(pathname, QUICK_LINKS[index].href));
  navigate.current = (index) => irParaBarra(pathname, QUICK_LINKS[index].href);
  const suppressedUntil = useRef(0);
  useEffect(() => {
    AccessibilityInfo.isScreenReaderEnabled().then(setScreenReader).catch(() => {});
    const subscription = AccessibilityInfo.addEventListener("screenReaderChanged", setScreenReader);
    AccessibilityInfo.isReduceMotionEnabled().then(value => { reduceMotion.current = value; }).catch(() => {});
    const motion = AccessibilityInfo.addEventListener("reduceMotionChanged", value => { reduceMotion.current = value; });
    return () => { subscription.remove(); motion.remove(); lensX.stopAnimation(); };
  }, []);
  const select = (index: number | null) => {
    if (index !== selected.current && index !== null) void Haptics.selectionAsync().catch(() => {});
    if (index !== null && items.current[index]) {
      const item = items.current[index];
      const x = Math.max(0, Math.min(bounds.current.width - Math.max(90, item.width), item.x - offset.current));
      if (selected.current === null || reduceMotion.current) lensX.setValue(x);
      else Animated.spring(lensX, { toValue: x, stiffness: 320, damping: 28, mass: 0.7, useNativeDriver: true }).start();
    } else lensX.stopAnimation();
    selected.current = index;
    setLens(index);
  };
  const finish = (commit: boolean) => {
    if (!held.current) return;
    const index = selected.current;
    held.current = false;
    suppressedUntil.current = Date.now() + 350;
    select(null);
    if (commit && index !== null) navigate.current(index);
  };
  const gestures = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponderCapture: () => held.current,
    onPanResponderMove: (event) => {
      const { pageX, pageY } = event.nativeEvent;
      const b = bounds.current;
      if (pageX < b.x || pageX > b.x + b.width || pageY < b.y - 50 || pageY > b.y + b.height + 30) { select(null); return; }
      const x = pageX - b.x + offset.current;
      const index = items.current.findIndex((item) => item && x >= item.x && x <= item.x + item.width);
      select(index < 0 ? null : index);
    },
    onPanResponderRelease: () => finish(true),
    onPanResponderTerminate: () => finish(false),
    onPanResponderTerminationRequest: () => false,
  }), []);
  const measure = () => frame.current?.measureInWindow((x, y, w, h) => { bounds.current = { x, y, width: w, height: h }; });
  const lensItem = lens === null ? null : items.current[lens];
  return <View ref={frame} collapsable={false} onTouchStart={measure} onTouchEnd={() => finish(true)} onTouchCancel={() => finish(false)} {...gestures.panHandlers}>
    <DockSurface><ScrollView horizontal scrollEnabled={scroll && lens === null} onScroll={(event) => { offset.current = event.nativeEvent.contentOffset.x; }} scrollEventThrottle={16} showsHorizontalScrollIndicator={false} style={styles.dock} contentContainerStyle={styles.content}>
    {QUICK_LINKS.map((item, i) => <Pressable key={item.href} onLayout={(event) => { items.current[i] = event.nativeEvent.layout; }} delayLongPress={220} onLongPress={Platform.OS === "ios" && !screenReader ? () => { held.current = true; select(i); } : undefined} accessibilityRole="button" accessibilityLabel={t(item.label)} accessibilityState={{ selected: pathname === item.href }} onPress={() => { if (held.current) { finish(true); return; } if (Date.now() > suppressedUntil.current) irParaBarra(pathname, item.href); }} style={({ pressed }) => [styles.item, scroll ? { width: 120, flexBasis: 120, flexGrow: 0, flexShrink: 0 } : { flex: i === 4 ? 1.4 : 1 }, i > 0 && styles.divider, (pressed || pathname === item.href) && styles.selected]}>
      <Ionicons name={item.icon} size={21} color="#29434a" />
      <Text style={[styles.label, scroll && { fontSize: 12 }]}>{t(item.label)}</Text>
    </Pressable>)}
  </ScrollView></DockSurface>
    {lens !== null && lensItem && <Animated.View pointerEvents="none" accessible={false} accessibilityElementsHidden style={[styles.lens, { transform: [{ translateX: lensX }], width: Math.max(90, lensItem.width) }]}>
      <DockSurface interactive><View style={styles.lensContent}>
        <Ionicons name={QUICK_LINKS[lens].icon} size={29} color="#29434a" />
        <Text style={[styles.label, { fontSize: 12 }]}>{t(QUICK_LINKS[lens].label)}</Text>
      </View></DockSurface>
    </Animated.View>}
  </View>;
}
const styles = StyleSheet.create({
  lens: { position: "absolute", left: 0, top: -14, zIndex: 10 },
  lensContent: { minHeight: 90, justifyContent: "center", alignItems: "center", paddingHorizontal: 4, paddingVertical: 10, gap: 8 },
  dock: { flexGrow: 0, borderRadius: 28 },
  content: { flexGrow: 1, paddingVertical: 10, paddingHorizontal: 3 },
  item: { minHeight: 48, alignItems: "center", justifyContent: "center", paddingHorizontal: 2, gap: 7 },
  label: { fontSize: 10, fontWeight: "700", color: "#29434a", textAlign: "center", width: "100%" },
  divider: { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: "#c9d1cf" },
  selected: { backgroundColor: "#dfe9e7", borderRadius: 16 },
});
