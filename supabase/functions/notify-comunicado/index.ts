// Push segmentado de um comunicado publicado (mural).
// Deploy: supabase functions deploy notify-comunicado --no-verify-jwt
// Chamado pelo backend (routes/comunicados.js) ao publicar.
// Audiência: usuários do app com push token; se segmento != 'todos', filtra
// pelos membros com frequenta_area = segmento.
import { notificar, makeAdmin } from "../_shared/notify.ts";

Deno.serve(async (req) => {
  try {
    const { comunicado_id } = await req.json();
    if (!comunicado_id) return new Response("sem comunicado_id", { status: 200 });

    const sb = makeAdmin();
    const { data: c } = await sb
      .from("comunicados")
      .select("id, titulo, corpo, segmento, status")
      .eq("id", comunicado_id)
      .maybeSingle();
    if (!c || c.status !== "publicado") return new Response("não publicado", { status: 200 });

    // Quem tem push token (instalou + autorizou)
    const { data: tokens } = await sb.from("app_push_tokens").select("user_id");
    let userIds = [...new Set((tokens ?? []).map((t) => t.user_id as string))];

    // Segmentado por área (ami/bridge/online/sede/kids)
    if (c.segmento && c.segmento !== "todos") {
      const { data: membros } = await sb
        .from("mem_membros")
        .select("id")
        .eq("frequenta_area", c.segmento)
        .is("deleted_at", null);
      const memIds = (membros ?? []).map((m) => m.id as string);
      if (!memIds.length) return new Response("sem membros no segmento", { status: 200 });
      const { data: profs } = await sb.from("profiles").select("id").in("membro_id", memIds);
      const permitido = new Set((profs ?? []).map((p) => p.id as string));
      userIds = userIds.filter((u) => permitido.has(u));
    }

    if (!userIds.length) return new Response("sem destinatários", { status: 200 });

    await notificar(
      { userIds },
      {
        tipo: "comunicado",
        titulo: String(c.titulo),
        body: String(c.corpo).slice(0, 180),
        data: { tipo: "comunicado", comunicado_id: c.id },
      }
    );
    return new Response(`ok · ${userIds.length} alvos`, { status: 200 });
  } catch (e) {
    return new Response(`erro: ${e}`, { status: 500 });
  }
});
