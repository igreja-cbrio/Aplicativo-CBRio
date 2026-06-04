// Dispara push quando um voluntário é escalado.
// Deploy: supabase functions deploy notify-escala
// Webhook: Database -> Webhooks -> tabela mem_escalas, evento INSERT,
//          tipo Supabase Edge Functions -> notify-escala.
import { notificar, makeAdmin } from "../_shared/notify.ts";

Deno.serve(async (req) => {
  try {
    const payload = await req.json();
    const escala = payload.record ?? payload;
    const membroId = escala?.membro_id;
    if (!membroId) return new Response("sem membro_id", { status: 200 });

    const sb = makeAdmin();

    let ministerio = "um ministério";
    if (escala.ministerio_id) {
      const { data: min } = await sb
        .from("mem_ministerios")
        .select("nome")
        .eq("id", escala.ministerio_id)
        .maybeSingle();
      if (min?.nome) ministerio = min.nome;
    }
    const dataTxt = escala.data
      ? new Date(escala.data).toLocaleDateString("pt-BR")
      : "";

    await notificar(
      { membroIds: [membroId] },
      {
        tipo: "escala",
        titulo: "Você foi escalado! 🙌",
        body: `Escala em ${ministerio}${dataTxt ? ` — ${dataTxt}` : ""}. Abra o app para confirmar.`,
        data: { escala_id: escala.id, ministerio_id: escala.ministerio_id ?? null },
      }
    );

    return new Response("ok", { status: 200 });
  } catch (e) {
    return new Response(`erro: ${e}`, { status: 500 });
  }
});
