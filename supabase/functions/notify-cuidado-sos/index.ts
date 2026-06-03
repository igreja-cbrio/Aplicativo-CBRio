// Edge Function (Supabase) — alerta os pastores responsáveis quando chega um SOS.
// Deploy no projeto do SISTEMA:
//   supabase functions deploy notify-cuidado-sos
// Database Webhook: Database -> Webhooks -> New
//   tabela: public.app_inscricoes | evento: INSERT | -> Edge Function notify-cuidado-sos
//
// PASTORES RESPONSÁVEIS: lista fixa de CPFs (Marcílio, Nélio, Wesley Ramos).
// Preencha os CPFs abaixo (só dígitos). Eles precisam ter o APP instalado e
// logado (para ter token em app_push_tokens).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// >>> EDITE AQUI: CPFs dos pastores (somente dígitos) <<<
const CPFS_PASTORES = [
  "00000000000", // Marcílio Nélio Paiva
  "00000000000", // Wesley Ramos
];

const onlyDigits = (s: string) => (s ?? "").replace(/\D/g, "");

Deno.serve(async (req) => {
  try {
    const payload = await req.json();
    const row = payload.record ?? payload;
    if (!row || row.tipo !== "sos") return new Response("ignorado", { status: 200 });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const dados = row.dados ?? {};
    const nome = dados.nome ?? "Alguém";
    const telefone = dados.telefone ?? "";

    const alvo = new Set(CPFS_PASTORES.map(onlyDigits));

    // Acha os membros dos pastores pelo CPF (normalizando formato no JS)
    const { data: membros } = await supabase
      .from("mem_membros")
      .select("id, cpf")
      .not("cpf", "is", null);
    const membroIds = (membros ?? [])
      .filter((m) => alvo.has(onlyDigits(m.cpf)))
      .map((m) => m.id);
    if (membroIds.length === 0) return new Response("sem pastores", { status: 200 });

    // profiles -> tokens
    const { data: profs } = await supabase
      .from("profiles")
      .select("id")
      .in("membro_id", membroIds);
    const ids = (profs ?? []).map((p) => p.id);
    if (ids.length === 0) return new Response("sem profiles", { status: 200 });

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

