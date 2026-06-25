// Push: novo devocional da semana publicado.
// Deploy: supabase functions deploy notify-devocional-semana --no-verify-jwt
// Chamado pelo backend (routes/devocionalPlanos.js) quando a equipe sobe/gera a
// semana. Broadcast pra todos os usuários do app com push token.
// Self-contained (não importa ../_shared) pra deploy isolado.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  try {
    const body = await req.json().catch(() => ({}));
    const titulo = body?.titulo || "Devocional da semana 📖";
    const corpo =
      body?.body || "O devocional desta semana já está no app. Bora começar?";
    const data = { tipo: "devocional", deeplink: "/devocional" };

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: toks } = await sb.from("app_push_tokens").select("user_id, token");
    const tokens = (toks ?? []) as { user_id: string; token: string }[];
    const userIds = [...new Set(tokens.map((t) => t.user_id))];
    if (!userIds.length) return new Response("sem destinatários", { status: 200 });

    // histórico no app (1 por user)
    await sb.from("app_notificacoes").insert(
      userIds.map((u) => ({ user_id: u, tipo: "devocional", titulo, body: corpo, data }))
    );

    // push via Expo
    const messages = tokens.map((t) => ({
      to: t.token,
      sound: "cbrio-chime.wav",
      channelId: "default",
      title: titulo,
      body: corpo,
      data,
    }));
    try {
      await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(messages),
      });
    } catch (e) {
      console.log("[notify-devocional] expo erro:", e);
    }

    return new Response(`ok · ${userIds.length} alvos`, { status: 200 });
  } catch (e) {
    return new Response(`erro: ${e}`, { status: 500 });
  }
});
