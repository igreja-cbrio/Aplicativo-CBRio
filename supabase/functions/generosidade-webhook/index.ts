// Webhook do Stripe pra Generosidade.
// Recebe payment_intent.succeeded (cartão + Apple Pay) e checkout.session.completed
// (Checkout WebView) e persiste em mem_contribuicoes — categoria, valor, método,
// membro_id, payment_intent_id pra dedup.
//
// Secrets: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET (do endpoint do dashboard),
// SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
//
// Como configurar (uma vez):
// dashboard.stripe.com/webhooks -> "Add endpoint"
//   URL: https://hhntwfawfnxvuobhdfkb.supabase.co/functions/v1/generosidade-webhook
//   Eventos: payment_intent.succeeded, checkout.session.completed
//   Cole o "Signing secret" (whsec_...) em STRIPE_WEBHOOK_SECRET.
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

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("method", { status: 405 });

  const sig = req.headers.get("stripe-signature");
  const whsec = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  if (!sig || !whsec) return new Response("missing signature", { status: 400 });

  let event: Stripe.Event;
  try {
    const raw = await req.text();
    event = await stripe.webhooks.constructEventAsync(raw, sig, whsec);
  } catch (e) {
    console.log("[webhook] assinatura inválida:", e);
    return new Response("bad signature", { status: 400 });
  }

  try {
    if (event.type === "payment_intent.succeeded") {
      const pi = event.data.object as Stripe.PaymentIntent;
      await persistir({
        payment_intent_id: pi.id,
        amount_cents: pi.amount_received ?? pi.amount,
        currency: pi.currency,
        meta: pi.metadata ?? {},
        forma: detectarFormaPI(pi),
      });
    } else if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const piId = (typeof session.payment_intent === "string"
        ? session.payment_intent
        : session.payment_intent?.id) ?? "";
      if (!piId) return new Response("ok-no-pi", { status: 200 });
      // O metadata está no PaymentIntent que criamos em
      // checkout.sessions.create.payment_intent_data.metadata.
      const pi = await stripe.paymentIntents.retrieve(piId);
      await persistir({
        payment_intent_id: pi.id,
        amount_cents: pi.amount_received ?? pi.amount,
        currency: pi.currency,
        meta: { ...(session.metadata ?? {}), ...(pi.metadata ?? {}) },
        forma: detectarFormaPI(pi),
      });
    }
  } catch (e) {
    console.log("[webhook] erro processando:", e);
    return new Response(`err: ${e}`, { status: 500 });
  }

  return new Response("ok", { status: 200 });
});

async function persistir(p: {
  payment_intent_id: string;
  amount_cents: number;
  currency: string;
  meta: Record<string, string>;
  forma: string;
}) {
  // Dedup: já existe?
  const { data: existente } = await supabaseAdmin
    .from("mem_contribuicoes")
    .select("id")
    .eq("referencia_externa", p.payment_intent_id)
    .maybeSingle();
  if (existente) {
    console.log("[webhook] já persistido:", p.payment_intent_id);
    return;
  }

  const categoria = ["dizimo", "oferta", "campanha"].includes(p.meta.categoria)
    ? p.meta.categoria
    : "oferta";
  const campanha = (p.meta.campanha || "").trim() || null;
  const membroId = (p.meta.membro_id || "").trim() || null;

  const valor = p.amount_cents / 100;
  const hoje = new Date().toISOString().slice(0, 10);

  const { error } = await supabaseAdmin.from("mem_contribuicoes").insert({
    membro_id: membroId,
    tipo: categoria,
    valor,
    data: hoje,
    campanha: categoria === "campanha" ? campanha : null,
    forma_pagamento: p.forma,
    origem: "app",
    referencia_externa: p.payment_intent_id,
    observacoes: `Generosidade via app (${p.meta.metodo ?? p.forma}) - ${p.currency.toUpperCase()}`,
  });
  if (error) {
    console.log("[webhook] erro insert:", error.message);
    throw error;
  }
  console.log("[webhook] contribuição persistida:", p.payment_intent_id, "membro=", membroId);
}

function detectarFormaPI(pi: Stripe.PaymentIntent): string {
  // Tenta inferir entre 'cartao' e 'apple_pay' pelo charge wallet
  const charges = (pi as unknown as { charges?: { data?: Stripe.Charge[] } }).charges?.data;
  const wallet = charges?.[0]?.payment_method_details?.card?.wallet?.type;
  if (wallet === "apple_pay") return "apple_pay";
  return "cartao";
}
