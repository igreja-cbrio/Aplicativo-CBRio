import { type ComponentType } from "react";
import { Platform, type StyleProp, type ViewStyle } from "react-native";

type NativeProps = {
  buttonType?: "donate" | "buy" | "checkout" | "continue" | "inStore" | "plain";
  buttonStyle?: "black" | "white" | "whiteOutline" | "automatic";
  cornerRadius?: number;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
};

export type ApplePayButtonProps = NativeProps & { disabled?: boolean };

/**
 * Botão oficial do Apple Pay (PKPaymentButton) — visual desenhado pelo
 * sistema, com rótulo localizado ("Doar com  Pay" no tipo donate),
 * conforme as HIG. `null` fora do iOS ou em binário sem o módulo
 * (ex.: dev client antigo) — o chamador decide o fallback.
 */
let NativeButton: ComponentType<NativeProps> | null = null;
if (Platform.OS === "ios") {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { requireNativeView } = require("expo");
    NativeButton = requireNativeView("ApplePay") as ComponentType<NativeProps>;
  } catch {
    NativeButton = null;
  }
}

export const applePayButtonNativo = NativeButton != null;

export function ApplePayButton({
  disabled,
  onPress,
  buttonType = "donate",
  buttonStyle = "black",
  cornerRadius = 999,
  style,
}: ApplePayButtonProps) {
  if (!NativeButton) return null;
  return (
    <NativeButton
      buttonType={buttonType}
      buttonStyle={buttonStyle}
      cornerRadius={cornerRadius}
      onPress={() => {
        if (!disabled) onPress?.();
      }}
      style={[{ height: 50 }, style, disabled ? { opacity: 0.5 } : null]}
    />
  );
}
