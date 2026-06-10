import { type ComponentType } from "react";
import { Platform, type StyleProp, type ViewStyle } from "react-native";

type ButtonType = "donate" | "buy" | "checkout" | "continue" | "inStore" | "plain";
type ButtonStyle = "black" | "white" | "whiteOutline" | "automatic";

// Props da view nativa. O evento se chama `onApplePress` (NÃO `onPress`:
// colidiria com o `topPress` core do RN).
type NativeProps = {
  buttonType?: ButtonType;
  buttonStyle?: ButtonStyle;
  cornerRadius?: number;
  onApplePress?: () => void;
  style?: StyleProp<ViewStyle>;
};

// API pública do componente — expõe o `onPress` convencional.
export type ApplePayButtonProps = {
  buttonType?: ButtonType;
  buttonStyle?: ButtonStyle;
  cornerRadius?: number;
  onPress?: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

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
    // Nome explícito da view (o módulo tem 2: pagamento e Add-to-Wallet).
    NativeButton = requireNativeView(
      "ApplePay",
      "ApplePayButtonView"
    ) as ComponentType<NativeProps>;
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
      onApplePress={() => {
        if (!disabled) onPress?.();
      }}
      style={[{ height: 50 }, style, disabled ? { opacity: 0.5 } : null]}
    />
  );
}
