import { type ComponentType } from "react";
import { Platform, type LayoutChangeEvent, type StyleProp, type ViewStyle } from "react-native";

export type NativeShortcutsProps = {
  labels: string[];
  selectedIndex: number;
  onShortcutSelect: (event: { nativeEvent: { index: number } }) => void;
  style?: StyleProp<ViewStyle>;
};
type HostProps = NativeShortcutsProps & { onLayout: (event: LayoutChangeEvent) => void };

let NativeShortcutsHost: ComponentType<HostProps> | null = null;
if (Platform.OS === "ios" && Number.parseInt(String(Platform.Version), 10) >= 26) {
  try {
    const { requireOptionalNativeModule, requireNativeView } = require("expo");
    if (requireOptionalNativeModule("NativeShortcuts")?.available) {
      NativeShortcutsHost = requireNativeView("NativeShortcuts") as ComponentType<HostProps>;
    }
  } catch { /* Binários anteriores mantêm os atalhos comuns por toque. */ }
}

export { NativeShortcutsHost };
