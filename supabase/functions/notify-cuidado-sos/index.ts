// Alerta os pastores responsáveis quando chega um SOS.
// Deploy: supabase functions deploy notify-cuidado-sos
// Webhook: Database -> Webhooks -> tabela app_inscricoes, evento INSERT,
//          tipo Supabase Edge Functions -> notify-cuidado-sos.
//
// PASTORES RESPONSÁVEIS: lista fixa de CPFs (somente dígitos).
import { notificar, makeAdmin } from "../_shared/notify.ts";
import { rejeitarSeNaoAutorizado } from "../_shared/segredo.ts";

// CPFs dos pastores (somente dígitos, separados por vírgula) vêm do secret
// SOS_PASTOR_CPFS — PII fora do repositório:
//   supabase secrets set SOS_PASTOR_CPFS="cpf1,cpf2"
// A lista fixa abaixo é só fallback histórico (placeholder, não notifica ninguém).
const CPFS_PASTORES: string[] = (() => {
  const doEnv = (Deno.env.get("SOS_PASTOR_CPFS") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return doEnv.length
    ? doEnv
    : [
        "00000000000", // Marcílio Nélio Paiva (placeholder)
        "00000000000", // Wesley Ramos (placeholder)
      ];
})();

const onlyDigits = (s: string) => (s ?? "").replace(/\D/g, "");

Deno.serve(async (req) => {
  const neg = rejeitarSeNaoAutorizado(req);
  if (neg) return neg;
  try {
    const payload = await req.json();
    const row = payload.record ?? payload;
    if (!row || row.tipo !== "sos") return new Response("ignorado", { status: 200 });

    const sb = makeAdmin();

    // Defesa em profundidade: nome/telefone exibidos no push são RE-LIDOS do
    // banco pelo id, nunca confiados no corpo da requisição.
    if (!row.id) return new Response("sem id", { status: 200 });
    const { data: real } = await sb
      .from("app_inscricoes")
      .select("id, tipo, dados")
      .eq("id", row.id)
      .maybeSingle();
    if (!real || real.tipo !== "sos") return new Response("ignorado", { status: 200 });

    const dados = (real.dados ?? {}) as { nome?: string; telefone?: string };
    const nome = dados.nome ?? "Alguém";
    const telefone = dados.telefone ?? "";

    const alvo = new Set(CPFS_PASTORES.map(onlyDigits));

    const { data: membros } = await sb
      .from("mem_membros")
      .select("id, cpf")
      .not("cpf", "is", null);
    const membroIds = (membros ?? [])
      .filter((m) => alvo.has(onlyDigits(m.cpf)))
      .map((m) => m.id as string);
    if (!membroIds.length) return new Response("sem pastores", { status: 200 });

    await notificar(
      { membroIds },
      {
        tipo: "sos",
        titulo: "🚨 Pedido de ajuda (SOS)",
        body: `${nome} pediu ajuda urgente pelo app${telefone ? ` — ${telefone}` : ""}. Entre em contato o quanto antes.`,
        data: { inscricao_id: row.id, telefone },
      }
    );

    return new Response("ok", { status: 200 });
  } catch (e) {
    return new Response(`erro: ${e}`, { status: 500 });
  }
});
