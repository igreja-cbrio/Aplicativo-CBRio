export type ApplePayNetwork =
  | "visa"
  | "mastercard"
  | "amex"
  | "discover"
  | "elo"
  | "jcb"
  | "interac"
  | "maestro";

export type ApplePayRequest = {
  merchantId: string;
  amountCents: number;
  countryCode?: string;     // "BR"
  currencyCode?: string;    // "BRL"
  label?: string;           // texto mostrado na sheet
  supportedNetworks?: ApplePayNetwork[];
};

export type ApplePayTokenResult = {
  /** PaymentData decodificado (objeto criptografado). */
  paymentData: Record<string, unknown>;
  /** O mesmo paymentData em base64, fácil de enviar pro backend. */
  paymentDataBase64: string;
  transactionIdentifier: string;
  paymentMethod: {
    displayName: string;
    network: string;
    type: "credit" | "debit" | "prepaid" | "store" | "unknown";
  };
};
