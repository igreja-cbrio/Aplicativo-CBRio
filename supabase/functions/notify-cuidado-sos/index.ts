// Edge Function (Supabase) — alerta os pastores quando chega um SOS/cuidado urgente.
// Deploy no projeto do SISTEMA:
//   supabase functions deploy notify-cuidado-sos
// Database Webhook: Database -> Webhooks -> New
//   tabela: public.app_inscricoes | evento: INSERT | -> Edge Function notify-cuidado-sos
//
// ⚠️ AJUSTAR quem são os "pastores responsáveis" (ver QUERY abaixo): hoje usa
// profiles com role 'diretor' ou 'admin'. Troque pela regra real (ex.: uma
// coluna/área específica, ou uma tabela de pastores de plantão).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  try {
    const payload = await req.json();
    const row = payload.record ?? payload;
    // só reage a SOS (urgente) — ajuste se quiser alertar 'aconselhamento' também
    if (!row || row.tipo !== "sos") return new Response("ignorado", { status: 200 });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const dados = row.dados ?? {};
    const nome = dados.nome ?? "Alguém";
    const telefone = dados.telefone ?? "";

    // Pastores responsáveis (AJUSTAR esta regra conforme o sistema)
    const { data: pastores } = await supabase
      .from("profiles")
      .select("id")
      .in("role", ["diretor", "admin"]);

    const ids = (pastores ?? []).map((p) => p.id);
    if (ids.length === 0) return new Response("sem pastores", { status: 200 });

    const { data: tokens } = await supabase
      .from("app_push_tokens")
      .select("token")
      .in("user_id", ids);

    if (!tokens?.length) return new Response("sem tokens", { status: 200 });

    const messages = tokens.map((t) => ({
      to: t.token,
      sound: "default",
      priority: "high",
      title: "🚨 Pedido de ajuda (SOS)",
      body: `${nome} pediu ajuda urgente pelo app${telefone ? ` — ${telefone}` : ""}. Entre em contato o quanto antes.`,
      data: { tipo: "sos", inscricao_id: row.id },
    }));

    await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(messages),
    });

    return new Response("ok", { status: 200 });
  } catch (e) {
    return new Response(`erro: ${e}`, { status: 500 });
  }
});
