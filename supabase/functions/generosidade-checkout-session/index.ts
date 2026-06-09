// Cria uma Stripe Checkout Session pra doação via cartão e devolve a URL
// pro app abrir num WebView. Success/cancel redirecionam pra deep links
// do app. Metadata da session leva o auth_user_id + categoria +
// campanha pra o webhook depois persistir em mem_contribuicoes.
//
// Secrets: STRIPE_SECRET_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
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
    // Valida JWT do membro
    const auth = req.headers.get("Authorization") ?? "";
    const jwt = auth.replace(/^Bearer\s+/i, "");
    if (!jwt) return json({ error: "Sessão expirada." }, 401);
    const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(jwt);
    if (userErr || !userData.user) return json({ error: "Token inválido." }, 401);
    const authUserId = userData.user.id;

    // Busca membro_id (opcional — doação não exige vínculo)
    const { data: prof } = await supabaseAdmin
      .from("profiles")
      .select("membro_id")
      .eq("id", authUserId)
      .maybeSingle();
    const membroId = (prof?.membro_id as string | null) ?? null;

    const body = await req.json();
    const amountCents = Number(body.amount_cents);
    const descricao = (body.descricao as string) ?? "Generosidade CBRio";
    const categoria = String(body.categoria ?? "oferta");
    const campanha = body.campanha ? String(body.campanha).slice(0, 80) : null;

    if (!amountCents || amountCents < 100) {
      return json({ error: "Valor inválido (mínimo R$ 1,00)." }, 400);
    }
    if (!CATEGORIAS.has(categoria)) {
      return json({ error: "Categoria inválida." }, 400);
    }
    if (categoria === "campanha" && !campanha) {
      return json({ error: "Informe o nome da campanha." }, 400);
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
      payment_intent_data: {
        metadata: {
          origem: "app",
          metodo: "card",
          categoria,
          campanha: campanha ?? "",
          auth_user_id: authUserId,
          membro_id: membroId ?? "",
          descricao,
        },
      },
      metadata: {
        origem: "app",
        metodo: "card",
        categoria,
        campanha: campanha ?? "",
        auth_user_id: authUserId,
        membro_id: membroId ?? "",
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
