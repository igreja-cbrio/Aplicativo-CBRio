import ApplePay, { type ApplePayTokenResult } from "../modules/apple-pay";
import { supabase } from "./supabase";

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const APPLE_PAY_MERCHANT_ID =
  process.env.EXPO_PUBLIC_APPLE_PAY_MERCHANT_ID ?? "merchant.br.com.cbrio.app";

/**
 * Saber se o device suporta Apple Pay. Sem filtro de redes — antes
 * usávamos canMakePayments(usingNetworks:) restrito a Visa/MC/Amex/Elo,
 * que retornava false se o cartão na Wallet fosse de outra rede.
 * Agora usa apenas canMakePayments() (hardware/iOS suporta Apple Pay).
 * Se o usuário não tiver cartão, a própria sheet do PassKit oferece
 * adicionar um.
 */
export function applePayDisponivel(): Promise<boolean> {
  return ApplePay.isAvailable();
}

/** Abre a sheet nativa e devolve o token criptografado da Apple. */
export function abrirApplePay(amountCents: number, label = "Generosidade CBRio"): Promise<ApplePayTokenResult> {
  return ApplePay.requestPayment({
    merchantId: APPLE_PAY_MERCHANT_ID,
    amountCents,
    countryCode: "BR",
    currencyCode: "BRL",
    label,
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
  token: ApplePayTokenResult,
  meta?: { categoria?: "dizimo" | "oferta" | "campanha"; campanha?: string | null }
): Promise<{ ok: true; payment_intent_id: string }> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const auth = session?.access_token;
  if (!auth) throw new Error("Sessão expirada. Faça login novamente.");

  const resp = await fetch(
    `${SUPABASE_URL}/functions/v1/generosidade-apple-pay-confirm`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${auth}`,
      },
      body: JSON.stringify({
        amount_cents: amountCents,
        currency: "brl",
        categoria: meta?.categoria ?? "oferta",
        campanha: meta?.campanha ?? null,
        payment_token: {
          paymentDataBase64: token.paymentDataBase64,
          transactionIdentifier: token.transactionIdentifier,
          paymentMethod: token.paymentMethod,
        },
      }),
    }
  );
  if (!resp.ok) {
    const j = (await resp.json().catch(() => ({}))) as { error?: string };
    throw new Error(j.error || "Não foi possível confirmar o pagamento.");
  }
  return resp.json();
}
