// Edge Function (Supabase) — dispara push quando um voluntário é escalado.
// Deploy no projeto do SISTEMA:
//   supabase functions deploy notify-escala
// Depois, crie um Database Webhook: Database -> Webhooks -> New
//   tabela: public.mem_escalas | evento: INSERT | tipo: Supabase Edge Functions -> notify-escala
//
// Usa SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY (já disponíveis no ambiente de Functions).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  try {
    const payload = await req.json();
    const escala = payload.record ?? payload; // webhook envia { record: {...} }
    const membroId = escala?.membro_id;
    if (!membroId) return new Response("sem membro_id", { status: 200 });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Token(s) do membro
    const { data: tokens } = await supabase
      .from("app_push_tokens")
      .select("token")
      .eq("membro_id", membroId);

    if (!tokens?.length) return new Response("sem token", { status: 200 });

    // Nome do ministério (opcional)
    let ministerio = "um ministério";
    if (escala.ministerio_id) {
      const { data: min } = await supabase
        .from("mem_ministerios")
        .select("nome")
        .eq("id", escala.ministerio_id)
        .maybeSingle();
      if (min?.nome) ministerio = min.nome;
    }

    const dataTxt = escala.data
      ? new Date(escala.data).toLocaleDateString("pt-BR")
      : "";

    const messages = tokens.map((t) => ({
      to: t.token,
      sound: "default",
      title: "Você foi escalado! 🙌",
      body: `Escala em ${ministerio}${dataTxt ? ` — ${dataTxt}` : ""}. Abra o app para confirmar.`,
      data: { tipo: "escala", escala_id: escala.id },
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
