// Push "as fotos do seu batismo chegaram" — chamada pelo SISTEMA
// (backend/routes/batismoFotos.js) depois que o marketing sobe o álbum
// de uma data. Avisa só os batizados DAQUELE dia e só na 1ª vez que o
// álbum ganha fotos (dedup por data) — subir mais fotos depois não
// re-notifica.
//
// POST { data: "YYYY-MM-DD" }

import { makeAdmin, notificar } from "../_shared/notify.ts";

Deno.serve(async (req) => {
  try {
    const { data } = await req.json().catch(() => ({ data: null }));
    if (!data || !/^\d{4}-\d{2}-\d{2}$/.test(data)) {
      return new Response(JSON.stringify({ error: "data inválida" }), { status: 400 });
    }
    const sb = makeAdmin();

    // dedup: 1 aviso por data de batismo
    const { data: dedup } = await sb
      .from("app_lembretes_enviados")
      .upsert({ chave: `batismo-fotos:${data}` }, { onConflict: "chave", ignoreDuplicates: true })
      .select("chave");
    if (!(dedup?.length)) {
      return new Response(JSON.stringify({ ok: true, ja_avisado: true }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    const { data: inscricoes } = await sb
      .from("batismo_inscricoes")
      .select("membro_id")
      .eq("data_batismo", data)
      .neq("status", "cancelado")
      .not("membro_id", "is", null);

    const membroIds = [...new Set((inscricoes ?? []).map((i) => i.membro_id as string))];
    if (!membroIds.length) {
      return new Response(JSON.stringify({ ok: true, sem_batizados: true }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    await notificar(
      { membroIds },
      {
        tipo: "batismo",
        titulo: "As fotos do seu batismo chegaram! 📸",
        body: "Já estão no app, na aba Batismo. Veja, baixe e compartilhe esse dia tão especial. 💙",
      }
    );
    console.log(`[batismo-fotos] ${data} -> ${membroIds.length} batizados`);
    return new Response(JSON.stringify({ ok: true, avisados: membroIds.length }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[batismo-fotos] erro:", e);
    return new Response(JSON.stringify({ ok: false }), { status: 500 });
  }
});
