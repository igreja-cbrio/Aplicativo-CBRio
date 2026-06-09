import { Platform } from "react-native";
import type { ApplePayRequest, ApplePayTokenResult } from "./ApplePay.types";

type ApplePayNative = {
  isAvailable(networks?: string[]): Promise<boolean>;
  requestPayment(config: ApplePayRequest): Promise<ApplePayTokenResult>;
};

/**
 * Tenta carregar o módulo nativo. Se ainda não estiver compilado no
 * binário (ex.: o dev client está rodando build antigo), devolve um
 * stub que não crasha — só recusa o pagamento com erro claro.
 */
function carregar(): ApplePayNative {
  if (Platform.OS !== "ios") {
    return {
      isAvailable: async () => false,
      requestPayment: async () => {
        throw new Error("Apple Pay só está disponível em iOS.");
      },
    };
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { requireNativeModule } = require("expo");
    return requireNativeModule("ApplePay") as ApplePayNative;
  } catch (e) {
    console.log("[ApplePay] módulo nativo indisponível:", e);
    return {
      isAvailable: async () => false,
      requestPayment: async () => {
        throw new Error("Apple Pay indisponível neste build. Reinstale o app.");
      },
    };
  }
}

let cached: ApplePayNative | null = null;

const ApplePayProxy: ApplePayNative = {
  isAvailable: (networks) => {
    if (!cached) cached = carregar();
    return cached.isAvailable(networks);
  },
  requestPayment: (config) => {
    if (!cached) cached = carregar();
    return cached.requestPayment(config);
  },
};

export default ApplePayProxy;
