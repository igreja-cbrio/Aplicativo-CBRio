// Push pro MEMBRO quando o pastor muda o status do pedido de cuidado.
// Chamada pelo SISTEMA (backend/routes/cuidados.js) no PATCH do status.
// Fecha o ciclo emocional: a pessoa sabe que foi acolhida.
//
// POST { inscricao_id, status: "em_andamento" | "concluido" }

import { makeAdmin, notificar } from "../_shared/notify.ts";

const MENSAGENS: Record<string, { titulo: string; body: string }> = {
  em_andamento: {
    titulo: "Um pastor está cuidando de você 💙",
    body: "Recebemos seu pedido e já estamos cuidando dele. Em breve falamos com você.",
  },
  concluido: {
    titulo: "Seu pedido foi atendido 💙",
    body: "Que Deus continue te abençoando. Estamos sempre aqui por você.",
  },
};

Deno.serve(async (req) => {
  try {
    const { inscricao_id, status } = await req.json().catch(() => ({}));
    const msg = MENSAGENS[status];
    if (!inscricao_id || !msg) {
      return new Response(JSON.stringify({ ok: true, ignorado: true }), {
        headers: { "Content-Type": "application/json" },
      });
    }
    const sb = makeAdmin();

    const { data: insc } = await sb
      .from("app_inscricoes")
      .select("auth_user_id, membro_id")
      .eq("id", inscricao_id)
      .maybeSingle();
    if (!insc) {
      return new Response(JSON.stringify({ ok: true, sem_inscricao: true }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // Prefere auth_user_id (quem enviou); senão resolve pelo membro
    const target = insc.auth_user_id
      ? { userIds: [insc.auth_user_id as string] }
      : insc.membro_id
        ? { membroIds: [insc.membro_id as string] }
        : null;
    if (!target) {
      return new Response(JSON.stringify({ ok: true, sem_destino: true }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    await notificar(target, {
      tipo: "cuidado",
      titulo: msg.titulo,
      body: msg.body,
      data: { inscricao_id },
    });
    return new Response(JSON.stringify({ ok: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[cuidado-status] erro:", e);
    return new Response(JSON.stringify({ ok: false }), { status: 500 });
  }
});
