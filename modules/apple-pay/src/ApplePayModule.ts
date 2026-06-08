import { NativeModule, requireNativeModule } from "expo";
import type { ApplePayRequest, ApplePayTokenResult } from "./ApplePay.types";

declare class ApplePayModule extends NativeModule {
  isAvailable(networks?: string[]): Promise<boolean>;
  requestPayment(config: ApplePayRequest): Promise<ApplePayTokenResult>;
}

export default requireNativeModule<ApplePayModule>("ApplePay");
