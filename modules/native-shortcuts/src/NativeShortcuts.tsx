import { type ComponentType } from "react";
import { Platform, type StyleProp, type ViewStyle } from "react-native";

type Props = {
  labels: string[];
  selectedIndex: number;
  onShortcutSelect: (event: { nativeEvent: { index: number } }) => void;
  style?: StyleProp<ViewStyle>;
};

let NativeShortcuts: ComponentType<Props> | null = null;
if (Platform.OS === "ios" && Number.parseInt(String(Platform.Version), 10) >= 26) {
  try {
    const { requireOptionalNativeModule, requireNativeView } = require("expo");
    if (requireOptionalNativeModule("NativeShortcuts")?.available) {
      NativeShortcuts = requireNativeView("NativeShortcuts") as ComponentType<Props>;
    }
  } catch { /* Binários anteriores mantêm os atalhos comuns por toque. */ }
}

export { NativeShortcuts };
