import { supabase } from "./supabase";

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;

/**
 * Pede ao backend pra criar uma Checkout Session na Stripe e devolver a URL.
 *
 * Endpoint esperado:
 *   POST /api/app/generosidade/checkout-session
 *   body: { amount_cents, currency, descricao? }
 *   resp: { url, session_id }
 *
 * Backend cria a session com Stripe SDK (usando a sk_live) configurando:
 *  - payment_method_types: ["card"]
 *  - line_items: [{ price_data: { currency: 'brl', unit_amount, product_data: { name: 'Generosidade CBRio' } }, quantity: 1 }]
 *  - mode: "payment"
 *  - success_url: "cbrio://generosidade/sucesso"
 *  - cancel_url:  "cbrio://generosidade/cancelado"
 */
export async function criarCheckoutSession(params: {
  amountCents: number;
  descricao?: string;
}): Promise<{ url: string; session_id: string }> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const auth = session?.access_token;
  if (!auth) throw new Error("Sessão expirada. Faça login novamente.");

  const resp = await fetch(
    `${SUPABASE_URL}/functions/v1/generosidade-checkout-session`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${auth}`,
      },
      body: JSON.stringify({
        amount_cents: params.amountCents,
        currency: "brl",
        descricao: params.descricao ?? "Generosidade CBRio",
      }),
    }
  );
  if (!resp.ok) {
    const j = (await resp.json().catch(() => ({}))) as { error?: string };
    throw new Error(j.error || "Não foi possível iniciar o pagamento.");
  }
  return resp.json();
}
