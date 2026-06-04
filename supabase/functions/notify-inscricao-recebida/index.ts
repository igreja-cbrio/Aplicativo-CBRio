// Confirma para o usuário que sua inscrição foi recebida (push + histórico).
// Deploy: supabase functions deploy notify-inscricao-recebida
// Webhook: Database -> Webhooks -> tabela app_inscricoes, evento INSERT,
//          tipo Supabase Edge Functions -> notify-inscricao-recebida.
//
// Mensagem é específica por tipo (voluntariado, batismo, grupos, next…).
import { notificar } from "../_shared/notify.ts";

const TIPOS: Record<string, { titulo: string; body: string }> = {
  voluntariado: {
    titulo: "Inscrição de voluntariado recebida 💙",
    body: "Recebemos sua inscrição. Em breve a equipe entra em contato.",
  },
  batismo: {
    titulo: "Inscrição de batismo recebida 💧",
    body: "Que decisão linda! Em breve te chamamos pra alinhar a data.",
  },
  grupos: {
    titulo: "Pedido enviado ao grupo 👋",
    body: "O líder do grupo recebeu seu pedido e vai te chamar em breve.",
  },
  next: {
    titulo: "Inscrição NEXT recebida 🚀",
    body: "Recebemos sua inscrição no NEXT. Te aguardamos!",
  },
  oracao: {
    titulo: "Pedido de oração recebido 🙏",
    body: "Vamos orar por você. Em breve um pastor te procura.",
  },
  aconselhamento: {
    titulo: "Pedido de aconselhamento recebido 💙",
    body: "Recebemos seu pedido. A equipe de cuidados vai te procurar em breve.",
  },
};

Deno.serve(async (req) => {
  try {
    const payload = await req.json();
    const row = payload.record ?? payload;
    if (!row?.auth_user_id) return new Response("sem auth_user_id", { status: 200 });

    // SOS não confirma pro autor — quem precisa saber é o pastor.
    if (row.tipo === "sos") return new Response("ignorado (sos)", { status: 200 });

    const tipoCfg = TIPOS[row.tipo as string];
    if (!tipoCfg) return new Response("tipo desconhecido", { status: 200 });

    await notificar(
      { userIds: [row.auth_user_id as string] },
      {
        tipo: `inscricao_${row.tipo}`,
        titulo: tipoCfg.titulo,
        body: tipoCfg.body,
        data: { inscricao_id: row.id, inscricao_tipo: row.tipo },
      }
    );

    return new Response("ok", { status: 200 });
  } catch (e) {
    return new Response(`erro: ${e}`, { status: 500 });
  }
});
