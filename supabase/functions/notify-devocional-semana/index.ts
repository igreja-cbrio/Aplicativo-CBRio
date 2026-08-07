// Push: novo devocional da semana publicado.
// Deploy: supabase functions deploy notify-devocional-semana --no-verify-jwt
// Chamado pelo backend (routes/devocionalPlanos.js) quando a equipe sobe/gera a
// semana. Broadcast pra todos os usuários do app com push token.
//
// ⚠️⚠️ DEIXOU DE SER UM 3º REMETENTE (07/08/2026). Aqui havia uma cópia própria
// do envio — um `fetch` com TODAS as mensagens, sem chunk, sem agrupar por app
// Expo e com a resposta jogada fora. Era o maior broadcast da casa (275 das 615
// notificações in-app são devocional) e caía inteiro no
// `PUSH_TOO_MANY_EXPERIENCE_IDS`, junto com os outros 1.801 tickets.
// O comentário antigo dizia "self-contained pra deploy isolado" — isso não vale
// mais: o bundler do Supabase empacota o que for importado (provado no deploy,
// que lista `lib/pushLotes.ts` como asset). Agora usa o `notificar()` canônico,
// que agrupa por projeto, faz chunk de 100, LÊ a resposta e grava ticket.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { notificar } from "../_shared/notify.ts";

Deno.serve(async (req) => {
  try {
    const body = await req.json().catch(() => ({}));
    const titulo = body?.titulo || "Devocional da semana 📖";
    const corpo =
      body?.body || "O devocional desta semana já está no app. Bora começar?";

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // ⚠️ PAGINADO: o PostgREST capa em 1.000 linhas **sem erro**, então a partir
    // de ~1.000 instalações o broadcast alcançaria só o primeiro pedaço da base
    // e nenhum log acusaria. Hoje são 30 tokens — gatilho armado, não estrago.
    //
    // ⚠️ QUEM RECEBE AINDA É "QUEM TEM TOKEN", e isso é um segundo defeito, de
    // outra natureza (é decisão de produto, não de código): quem não tem token
    // — hoje TODO Android, porque o binário não tem Firebase — fica de fora até
    // do SINO IN-APP, não só do push. Está registrado pra decisão do Marcos.
    const userIds: string[] = [];
    const vistos = new Set<string>();
    for (let de = 0; ; de += 1000) {
      const { data, error } = await sb
        .from("app_push_tokens")
        .select("user_id")
        .range(de, de + 999);
      if (error) {
        console.log("[notify-devocional] erro ao ler tokens:", error.message);
        break;
      }
      const linhas = (data ?? []) as { user_id: string }[];
      for (const l of linhas) {
        if (l.user_id && !vistos.has(l.user_id)) { vistos.add(l.user_id); userIds.push(l.user_id); }
      }
      if (linhas.length < 1000) break;
    }
    if (!userIds.length) return new Response("sem destinatários", { status: 200 });

    const r = await notificar(
      { userIds },
      {
        tipo: "devocional",
        titulo,
        body: corpo,
        data: { tipo: "devocional", deeplink: "/devocional" },
      },
    );

    return new Response(
      `ok · ${userIds.length} alvos · ${r.enviados} push aceitos · ${r.persistidos} no sino`,
      { status: 200 },
    );
  } catch (e) {
    return new Response(`erro: ${e}`, { status: 500 });
  }
});
