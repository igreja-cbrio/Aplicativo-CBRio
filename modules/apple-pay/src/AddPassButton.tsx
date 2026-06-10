import { type ComponentType } from "react";
import { Platform, type StyleProp, type ViewStyle } from "react-native";

type NativeProps = {
  buttonStyle?: "black" | "blackOutline";
  cornerRadius?: number;
  // Nome único pra não colidir com o evento core "press" do RN.
  onAddPassPress?: () => void;
  style?: StyleProp<ViewStyle>;
};

export type AddPassButtonProps = {
  buttonStyle?: "black" | "blackOutline";
  cornerRadius?: number;
  onPress?: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

/**
 * Botão OFICIAL "Add to Apple Wallet" (PKAddPassButton) — exibe o ícone
 * e a arte da Wallet desenhados pelo sistema, conforme as HIG. `null`
 * fora do iOS ou em binário sem o módulo (o chamador decide o fallback).
 */
let NativeButton: ComponentType<NativeProps> | null = null;
if (Platform.OS === "ios") {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { requireNativeView } = require("expo");
    NativeButton = requireNativeView(
      "ApplePay",
      "AddPassButtonView"
    ) as ComponentType<NativeProps>;
  } catch {
    NativeButton = null;
  }
}

export const addPassButtonNativo = NativeButton != null;

export function AddPassButton({
  disabled,
  onPress,
  buttonStyle = "black",
  cornerRadius = 8,
  style,
}: AddPassButtonProps) {
  if (!NativeButton) return null;
  return (
    <NativeButton
      buttonStyle={buttonStyle}
      cornerRadius={cornerRadius}
      onAddPassPress={() => {
        if (!disabled) onPress?.();
      }}
      style={[{ height: 52 }, style, disabled ? { opacity: 0.5 } : null]}
    />
  );
}
