import { Platform } from "react-native";
import type { ApplePayRequest, ApplePayTokenResult } from "./ApplePay.types";

type ApplePayNative = {
  isAvailable(networks?: string[]): Promise<boolean>;
  requestPayment(config: ApplePayRequest): Promise<ApplePayTokenResult>;
  canAddPasses(): Promise<boolean>;
  addPass(base64: string): Promise<void>;
};

/**
 * Tenta carregar o módulo nativo. Se ainda não estiver compilado no
 * binário (ex.: o dev client está rodando build antigo), devolve um
 * stub que não crasha — só recusa a operação com erro claro.
 */
function carregar(): ApplePayNative {
  if (Platform.OS !== "ios") {
    return {
      isAvailable: async () => false,
      requestPayment: async () => {
        throw new Error("Apple Pay só está disponível em iOS.");
      },
      canAddPasses: async () => false,
      addPass: async () => {
        throw new Error("Apple Wallet só está disponível em iOS.");
      },
    };
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { requireNativeModule } = require("expo");
    return requireNativeModule("ApplePay") as ApplePayNative;
  } catch (e) {
    console.log("[ApplePay] módulo nativo indisponível:", e);
    const erro = () => {
      throw new Error("Recurso indisponível neste build. Reinstale o app.");
    };
    return {
      isAvailable: async () => false,
      requestPayment: erro,
      canAddPasses: async () => false,
      addPass: erro,
    };
  }
}

let cached: ApplePayNative | null = null;
function nativo(): ApplePayNative {
  if (!cached) cached = carregar();
  return cached;
}

const ApplePayProxy: ApplePayNative = {
  isAvailable: (networks) => nativo().isAvailable(networks),
  requestPayment: (config) => nativo().requestPayment(config),
  canAddPasses: () => nativo().canAddPasses(),
  addPass: (base64) => nativo().addPass(base64),
};

export default ApplePayProxy;
