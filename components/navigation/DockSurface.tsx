import { useEffect, useState, type ReactNode } from "react";
import { AccessibilityInfo, Platform, StyleSheet, View } from "react-native";
import { BlurView } from "expo-blur";
import type { GlassViewProps } from "expo-glass-effect";
import type { ComponentType } from "react";

// Binários anteriores e sistemas sem a API continuam com fallback seguro.
function glassComponent(): ComponentType<GlassViewProps> | null {
  if (Platform.OS !== "ios") return null;
  try {
    const glass = require("expo-glass-effect") as typeof import("expo-glass-effect");
    return glass.isGlassEffectAPIAvailable() && glass.isLiquidGlassAvailable() ? glass.GlassView : null;
  } catch { return null; }
}
const NativeGlass = glassComponent();
export function DockSurface({ children, interactive = false }: { children: ReactNode; interactive?: boolean }) {
  const [reduceTransparency, setReduceTransparency] = useState(false);
  useEffect(() => {
    if (Platform.OS !== "ios") return;
    let active = true;
    AccessibilityInfo.isReduceTransparencyEnabled().then((value) => { if (active) setReduceTransparency(value); }).catch(() => { if (active) setReduceTransparency(true); });
    const subscription = AccessibilityInfo.addEventListener("reduceTransparencyChanged", setReduceTransparency);
    return () => { active = false; subscription.remove(); };
  }, []);
  return <View style={styles.shadow}>
    {!reduceTransparency && NativeGlass ? <NativeGlass isInteractive={interactive} glassEffectStyle="regular" colorScheme="light" tintColor="rgba(247,250,244,0.3)" style={styles.shell}>{children}</NativeGlass>
      : !reduceTransparency && Platform.OS === "ios" ? <BlurView intensity={45} tint="light" style={[styles.shell, styles.frost]}>{children}</BlurView>
      : <View style={[styles.shell, styles.solid]}>{children}</View>}
  </View>;
}
const styles = StyleSheet.create({
  shadow: { borderRadius: 28, shadowColor: "#102e35", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 14 },
  shell: { borderRadius: 28, overflow: "hidden", borderWidth: 1, borderColor: "rgba(255,255,255,0.72)" },
  frost: { backgroundColor: "rgba(247,250,244,0.7)" },
  solid: { backgroundColor: "#f4f7f2" },
});
