import { useEffect, useState } from "react";
import { Keyboard, Platform, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { QuickLinks } from "@/components/navigation/QuickLinks";

export const BOTTOMBAR_H = 68;
/** Mesmo conjunto de atalhos da Home, fora do conteúdo e do teclado. */
export function BottomBar() {
  const insets = useSafeAreaInsets();
  const [keyboard, setKeyboard] = useState(false);
  useEffect(() => {
    if (Platform.OS !== "android") return;
    const show = Keyboard.addListener("keyboardDidShow", () => setKeyboard(true));
    const hide = Keyboard.addListener("keyboardDidHide", () => setKeyboard(false));
    return () => { show.remove(); hide.remove(); };
  }, []);
  if (keyboard) return null;
  return <View style={{ paddingTop: 10, paddingHorizontal: 20, paddingBottom: Math.max(insets.bottom, 12), backgroundColor: "#314b51" }}><QuickLinks /></View>;
}
