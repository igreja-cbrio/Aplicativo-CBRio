import { supabase } from "./supabase";

const BASE = "https://www.cbrio.org/api";

/**
 * Backend cria o PaymentIntent (Stripe Secret Key fica no servidor)
 * e retorna o client_secret pro app finalizar o pagamento no SDK.
 *
 * Endpoint esperado (a ser implementado no backend):
 *   POST /api/app/generosidade/payment-intent
 *   body: { amount_cents, currency, metodo: "card" | "apple_pay", descricao? }
 *   resp: { client_secret, ephemeral_key?, customer? }
 */
export type PaymentIntent = {
  client_secret: string;
  ephemeral_key?: string;
  customer?: string;
};

export async function criarPaymentIntent(params: {
  amountCents: number;
  metodo: "card" | "apple_pay";
  descricao?: string;
}): Promise<PaymentIntent> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error("Sessão expirada. Faça login novamente.");

  const resp = await fetch(`${BASE}/app/generosidade/payment-intent`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      amount_cents: params.amountCents,
      currency: "brl",
      metodo: params.metodo,
      descricao: params.descricao ?? "Generosidade CBRio",
    }),
  });
  if (!resp.ok) {
    const j = (await resp.json().catch(() => ({}))) as { error?: string };
    throw new Error(j.error || "Não foi possível iniciar o pagamento.");
  }
  return resp.json();
}

export const STRIPE_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY;
export const APPLE_PAY_MERCHANT_ID =
  process.env.EXPO_PUBLIC_APPLE_PAY_MERCHANT_ID ?? "merchant.br.com.cbrio.app";

export function stripeConfigurado(): boolean {
  const k = STRIPE_PUBLISHABLE_KEY ?? "";
  return k.startsWith("pk_") && k !== "pk_test_xxx";
}
