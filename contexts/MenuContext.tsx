import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Image, Keyboard, Modal, Pressable, StyleSheet, View, useWindowDimensions } from "react-native";
import { useRouter, type Href } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { MenuContent } from "@/components/navigation/MenuContent";
import { useAuth } from "@/contexts/AuthContext";
import { useT } from "@/lib/i18n";

const MenuContext = createContext<{ openMenu: () => void } | null>(null);
export function useMenu() {
  const value = useContext(MenuContext);
  if (!value) throw new Error("useMenu precisa de MenuProvider");
  return value;
}

export function MenuProvider({ children }: { children: React.ReactNode }) {
  const [visible, setVisible] = useState(false);
  const progress = useRef(new Animated.Value(0)).current;
  const closing = useRef(false), reduceMotion = useRef(false);
  const { width } = useWindowDimensions(), insets = useSafeAreaInsets(), router = useRouter(), t = useT();
  const { signOut } = useAuth();
  const panelWidth = Math.min(420, width * 0.88);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then((value) => { reduceMotion.current = value; });
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", (value) => { reduceMotion.current = value; });
    return () => subscription.remove();
  }, []);
  const openMenu = useCallback(() => {
    Keyboard.dismiss();
    closing.current = false;
    progress.setValue(0);
    setVisible(true);
  }, [progress]);
  const close = (next?: () => void) => {
    if (closing.current) return;
    closing.current = true;
    Animated.timing(progress, { toValue: 0, duration: reduceMotion.current ? 0 : 180, useNativeDriver: true }).start(({ finished }) => {
      if (!finished) return;
      setVisible(false);
      closing.current = false;
      next?.();
    });
  };
  return <MenuContext.Provider value={{ openMenu }}>
    <View style={{ flex: 1 }} accessibilityElementsHidden={visible} importantForAccessibility={visible ? "no-hide-descendants" : "auto"}>{children}</View>
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent onRequestClose={() => close()} onShow={() => Animated.timing(progress, { toValue: 1, duration: reduceMotion.current ? 0 : 220, useNativeDriver: true }).start()}>
      <View style={styles.overlay}>
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity: progress, backgroundColor: "rgba(7,22,26,0.55)" }]} />
        <Pressable accessibilityRole="button" accessibilityLabel={t("Fechar menu")} style={StyleSheet.absoluteFill} onPress={() => close()} />
        <Animated.View accessibilityViewIsModal style={[styles.panel, { width: panelWidth, paddingTop: insets.top, paddingBottom: insets.bottom, transform: [{ translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [panelWidth, 0] }) }] }]}>
          <View style={styles.header}>
            <View style={styles.logoFrame}><Image source={require("@/assets/images/cbrio-wordmark.png")} tintColor="#fff" resizeMode="contain" style={styles.logo} accessibilityLabel="CBRio" /></View>
            <Pressable accessibilityRole="button" accessibilityLabel={t("Fechar menu")} onPress={() => close()} style={styles.close}><Ionicons name="close-outline" size={30} color="#fff" /></Pressable>
          </View>
          <MenuContent onNavigate={(href: Href) => close(() => router.navigate(href))} onSignOut={() => close(() => { void signOut(); })} />
        </Animated.View>
      </View>
    </Modal>
  </MenuContext.Provider>;
}
const styles = StyleSheet.create({
  overlay: { flex: 1, alignItems: "flex-end" },
  panel: { height: "100%", backgroundColor: "#314b51", borderTopLeftRadius: 28, borderBottomLeftRadius: 28 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 22 },
  logoFrame: { width: 100, height: 36, overflow: "hidden" },
  logo: { position: "absolute", width: 100, height: 100, top: -32 },
  close: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
});
