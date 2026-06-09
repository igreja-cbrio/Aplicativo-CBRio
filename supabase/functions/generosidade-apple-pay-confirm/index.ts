// Recebe o token Apple Pay cru do app, cria Stripe Token + PaymentIntent
// confirmado, e devolve o resultado. Categoria + campanha vão no metadata
// pra o webhook depois persistir em mem_contribuicoes.
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2024-04-10",
  httpClient: Stripe.createFetchHttpClient(),
});

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const CATEGORIAS = new Set(["dizimo", "oferta", "campanha"]);

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("method", { status: 405 });

  try {
    const auth = req.headers.get("Authorization") ?? "";
    const jwt = auth.replace(/^Bearer\s+/i, "");
    if (!jwt) return json({ error: "Sessão expirada." }, 401);
    const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(jwt);
    if (userErr || !userData.user) return json({ error: "Token inválido." }, 401);
    const authUserId = userData.user.id;

    const { data: prof } = await supabaseAdmin
      .from("profiles")
      .select("membro_id")
      .eq("id", authUserId)
      .maybeSingle();
    const membroId = (prof?.membro_id as string | null) ?? null;

    const body = await req.json();
    const amountCents = Number(body.amount_cents);
    const currency = (body.currency as string) ?? "brl";
    const categoria = String(body.categoria ?? "oferta");
    const campanha = body.campanha ? String(body.campanha).slice(0, 80) : null;
    const tok = body.payment_token as {
      paymentDataBase64: string;
      transactionIdentifier: string;
      paymentMethod?: { displayName?: string; network?: string };
    };

    if (!amountCents || amountCents < 100) {
      return json({ error: "Valor inválido (mínimo R$ 1,00)." }, 400);
    }
    if (!CATEGORIAS.has(categoria)) {
      return json({ error: "Categoria inválida." }, 400);
    }
    if (categoria === "campanha" && !campanha) {
      return json({ error: "Informe o nome da campanha." }, 400);
    }
    if (!tok?.paymentDataBase64) {
      return json({ error: "Token Apple Pay inválido." }, 400);
    }

    const paymentDataJson = atob(tok.paymentDataBase64);

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
        origem: "app",
        metodo: "apple_pay",
        categoria,
        campanha: campanha ?? "",
        auth_user_id: authUserId,
        membro_id: membroId ?? "",
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
