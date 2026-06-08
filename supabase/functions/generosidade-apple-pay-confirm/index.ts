// Recebe o token Apple Pay cru (PKPaymentToken) do app, cria um Stripe
// Token a partir dele e confirma um PaymentIntent na hora.
//
// Body esperado:
//   { amount_cents, currency: 'brl',
//     payment_token: { paymentDataBase64, transactionIdentifier, paymentMethod: { network, displayName, type } } }
//
// Secret necessária: STRIPE_SECRET_KEY.
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2024-04-10",
  httpClient: Stripe.createFetchHttpClient(),
});

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("method", { status: 405 });

  try {
    const body = await req.json();
    const amountCents = Number(body.amount_cents);
    const currency = (body.currency as string) ?? "brl";
    const tok = body.payment_token as {
      paymentDataBase64: string;
      transactionIdentifier: string;
      paymentMethod?: { displayName?: string; network?: string };
    };

    if (!amountCents || amountCents < 100) {
      return json({ error: "Valor inválido (mínimo R$ 1,00)." }, 400);
    }
    if (!tok?.paymentDataBase64) {
      return json({ error: "Token Apple Pay inválido." }, 400);
    }

    // Stripe espera o paymentData como string JSON (não base64).
    const paymentDataJson = atob(tok.paymentDataBase64);

    // 1) cria Stripe Token a partir do PKPayment
    const tokenParams = new URLSearchParams();
    tokenParams.set("card[pk_token]", paymentDataJson);
    if (tok.transactionIdentifier) {
      tokenParams.set("card[pk_token_transaction_id]", tok.transactionIdentifier);
    }
    if (tok.paymentMethod?.network) {
      tokenParams.set("card[pk_token_payment_network]", normalizeNetwork(tok.paymentMethod.network));
    }
    if (tok.paymentMethod?.displayName) {
      tokenParams.set("card[pk_token_instrument_name]", tok.paymentMethod.displayName);
    }

    const tokenResp = await fetch("https://api.stripe.com/v1/tokens", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${Deno.env.get("STRIPE_SECRET_KEY")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: tokenParams,
    });
    const tokenJson = await tokenResp.json();
    if (!tokenResp.ok) {
      console.log("[apple-pay-confirm] erro Stripe Token:", tokenJson);
      return json({ error: tokenJson?.error?.message ?? "Falha ao tokenizar." }, 400);
    }
    const stripeTokenId = tokenJson.id as string;

    // 2) cria + confirma PaymentIntent
    const intent = await stripe.paymentIntents.create({
      amount: amountCents,
      currency,
      payment_method_data: {
        type: "card",
        card: { token: stripeTokenId },
      },
      confirm: true,
      automatic_payment_methods: { enabled: true, allow_redirects: "never" },
      metadata: {
        origem: "app-apple-pay",
        transaction_id: tok.transactionIdentifier ?? "",
      },
    });

    if (intent.status !== "succeeded" && intent.status !== "requires_capture") {
      return json(
        {
          error: `Pagamento não confirmado (status: ${intent.status}).`,
          payment_intent_id: intent.id,
        },
        402
      );
    }

    return json({ ok: true, payment_intent_id: intent.id });
  } catch (e) {
    console.log("[apple-pay-confirm] erro:", e);
    const msg = e instanceof Error ? e.message : "Erro desconhecido";
    return json({ error: msg }, 500);
  }
});

/** Stripe espera nomes específicos de rede em camelCase. */
function normalizeNetwork(n: string): string {
  const map: Record<string, string> = {
    Visa: "visa",
    MasterCard: "masterCard",
    AmEx: "amex",
    Discover: "discover",
    JCB: "JCB",
    Elo: "elo",
  };
  return map[n] ?? n.toLowerCase();
}

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
