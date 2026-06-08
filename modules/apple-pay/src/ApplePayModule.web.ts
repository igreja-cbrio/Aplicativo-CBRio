// Stub web: Apple Pay nativo só existe em iOS.
import type { ApplePayRequest, ApplePayTokenResult } from "./ApplePay.types";

const ApplePayModule = {
  isAvailable: async (_networks?: string[]): Promise<boolean> => false,
  requestPayment: async (_config: ApplePayRequest): Promise<ApplePayTokenResult> => {
    throw new Error("Apple Pay nativo está disponível apenas em iOS.");
  },
};

export default ApplePayModule;
