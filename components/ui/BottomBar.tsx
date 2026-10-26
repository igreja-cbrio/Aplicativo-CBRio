import { useEffect, useState } from "react";
import { Keyboard, Platform, View, type LayoutChangeEvent } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { QuickLinks } from "@/components/navigation/QuickLinks";

export const BOTTOMBAR_H = 68;
/** Atalhos flutuam sobre a tela; a área fora da cápsula deixa os gestos passarem. */
export function BottomBar({ onLayout }: { onLayout?: (event: LayoutChangeEvent) => void }) {
  const insets = useSafeAreaInsets();
  const [keyboard, setKeyboard] = useState(false);
  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow", () => setKeyboard(true));
    const hide = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide", () => setKeyboard(false));
    return () => { show.remove(); hide.remove(); };
  }, []);
  if (keyboard) return null;
  return <View pointerEvents="box-none" onLayout={onLayout} style={{ position: "absolute", left: 0, right: 0, bottom: 0, paddingTop: 10, paddingHorizontal: 20, paddingBottom: Math.max(insets.bottom, 12), backgroundColor: "transparent" }}><QuickLinks /></View>;
}
