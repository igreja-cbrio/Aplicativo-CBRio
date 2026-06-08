// Cria uma Stripe Checkout Session pra doação via cartão e devolve a URL
// pro app abrir num WebView. Success/cancel redirecionam pra deep links
// do app (cbrio://generosidade/...).
//
// Secret necessária: STRIPE_SECRET_KEY (configure com `supabase secrets set`).
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
    const descricao = (body.descricao as string) ?? "Generosidade CBRio";
    if (!amountCents || amountCents < 100) {
      return json({ error: "Valor inválido (mínimo R$ 1,00)." }, 400);
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "brl",
            unit_amount: amountCents,
            product_data: { name: descricao },
          },
        },
      ],
      success_url: "cbrio://generosidade/sucesso?session_id={CHECKOUT_SESSION_ID}",
      cancel_url: "cbrio://generosidade/cancelado",
      // metadata só pra rastrear no Dashboard da Stripe
      metadata: {
        origem: "app",
        descricao,
      },
    });

    return json({ url: session.url, session_id: session.id });
  } catch (e) {
    console.log("[checkout-session] erro:", e);
    const msg = e instanceof Error ? e.message : "Erro desconhecido";
    return json({ error: msg }, 500);
  }
});

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
