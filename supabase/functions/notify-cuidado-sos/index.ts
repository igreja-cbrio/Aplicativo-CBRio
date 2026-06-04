// Alerta os pastores responsáveis quando chega um SOS.
// Deploy: supabase functions deploy notify-cuidado-sos
// Webhook: Database -> Webhooks -> tabela app_inscricoes, evento INSERT,
//          tipo Supabase Edge Functions -> notify-cuidado-sos.
//
// PASTORES RESPONSÁVEIS: lista fixa de CPFs (somente dígitos).
import { notificar, makeAdmin } from "../_shared/notify.ts";

// >>> EDITE AQUI: CPFs dos pastores <<<
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

    const sb = makeAdmin();

    const dados = row.dados ?? {};
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
