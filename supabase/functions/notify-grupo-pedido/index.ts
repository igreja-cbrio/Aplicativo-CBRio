// Notifica o líder do grupo (e admins/diretores) quando alguém pede pra
// entrar num grupo (INSERT em mem_grupo_pedidos).
// Deploy: supabase functions deploy notify-grupo-pedido
// Webhook: Database -> Webhooks -> tabela mem_grupo_pedidos, evento INSERT,
//          tipo Supabase Edge Functions -> notify-grupo-pedido.
import { notificar, makeAdmin } from "../_shared/notify.ts";

Deno.serve(async (req) => {
  try {
    const payload = await req.json();
    const ped = payload.record ?? payload;
    const grupoId = ped?.grupo_id;
    const membroId = ped?.membro_id;
    if (!grupoId) return new Response("sem grupo_id", { status: 200 });

    const sb = makeAdmin();

    // nome do grupo + líder (se a coluna existir)
    let grupoNome = "um grupo";
    let liderMembroId: string | null = null;
    try {
      const { data: g } = await sb
        .from("mem_grupos")
        .select("nome, lider_id")
        .eq("id", grupoId)
        .maybeSingle();
      if (g) {
        grupoNome = (g as { nome?: string }).nome ?? grupoNome;
        liderMembroId = (g as { lider_id?: string }).lider_id ?? null;
      }
    } catch {
      const { data: g } = await sb
        .from("mem_grupos")
        .select("nome")
        .eq("id", grupoId)
        .maybeSingle();
      grupoNome = (g as { nome?: string } | null)?.nome ?? grupoNome;
    }

    // nome do solicitante
    let solicitante = "Alguém";
    if (membroId) {
      const { data: m } = await sb
        .from("mem_membros")
        .select("nome")
        .eq("id", membroId)
        .maybeSingle();
      if (m?.nome) solicitante = m.nome as string;
    }

    // alvos = líder + admins/diretores
    const userIdsAlvo = new Set<string>();

    if (liderMembroId) {
      const { data: profLider } = await sb
        .from("profiles")
        .select("id")
        .eq("membro_id", liderMembroId);
      for (const p of profLider ?? []) userIdsAlvo.add(p.id as string);
    }
    const { data: profsAdmin } = await sb
      .from("profiles")
      .select("id")
      .in("role", ["admin", "diretor"]);
    for (const p of profsAdmin ?? []) userIdsAlvo.add(p.id as string);

    if (!userIdsAlvo.size) return new Response("sem alvos", { status: 200 });

    await notificar(
      { userIds: Array.from(userIdsAlvo) },
      {
        tipo: "grupo_pedido",
        titulo: "Novo pedido de entrada 👋",
        body: `${solicitante} quer entrar em ${grupoNome}.`,
        data: { grupo_id: grupoId, pedido_id: ped.id, membro_id: membroId },
      }
    );

    return new Response("ok", { status: 200 });
  } catch (e) {
    return new Response(`erro: ${e}`, { status: 500 });
  }
});
