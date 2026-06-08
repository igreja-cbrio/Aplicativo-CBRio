import ApplePay, { type ApplePayTokenResult } from "../modules/apple-pay";
import { supabase } from "./supabase";

const BASE = "https://www.cbrio.org/api";
const APPLE_PAY_MERCHANT_ID =
  process.env.EXPO_PUBLIC_APPLE_PAY_MERCHANT_ID ?? "merchant.br.com.cbrio.app";

/** Saber se o device tem Apple Pay disponível (cartões na Wallet, suporte ao tipo). */
export function applePayDisponivel(): Promise<boolean> {
  return ApplePay.isAvailable(["visa", "mastercard", "amex", "elo"]);
}

/** Abre a sheet nativa e devolve o token criptografado da Apple. */
export function abrirApplePay(amountCents: number): Promise<ApplePayTokenResult> {
  return ApplePay.requestPayment({
    merchantId: APPLE_PAY_MERCHANT_ID,
    amountCents,
    countryCode: "BR",
    currencyCode: "BRL",
    label: "Generosidade CBRio",
  });
}

/**
 * Backend recebe o token Apple Pay, monta PaymentMethod na Stripe usando
 * type=card + card[token]=... (ou via API Stripe direta) e confirma o
 * PaymentIntent.
 *
 * Endpoint esperado:
 *   POST /api/app/generosidade/apple-pay-confirm
 *   body: { amount_cents, payment_token: { paymentDataBase64, transactionIdentifier, paymentMethod } }
 *   resp: { ok: true, payment_intent_id }
 */
export async function confirmarApplePay(
  amountCents: number,
  token: ApplePayTokenResult
): Promise<{ ok: true; payment_intent_id: string }> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const auth = session?.access_token;
  if (!auth) throw new Error("Sessão expirada. Faça login novamente.");

  const resp = await fetch(`${BASE}/app/generosidade/apple-pay-confirm`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${auth}`,
    },
    body: JSON.stringify({
      amount_cents: amountCents,
      currency: "brl",
      payment_token: {
        paymentDataBase64: token.paymentDataBase64,
        transactionIdentifier: token.transactionIdentifier,
        paymentMethod: token.paymentMethod,
      },
    }),
  });
  if (!resp.ok) {
    const j = (await resp.json().catch(() => ({}))) as { error?: string };
    throw new Error(j.error || "Não foi possível confirmar o pagamento.");
  }
  return resp.json();
}
