// Helper compartilhado entre as Edge Functions de notificação.
// - busca tokens de push de um conjunto de user_id ou membro_id
// - dispara via Expo Push API
// - grava em app_notificacoes (histórico no app)
//
// Import: `import { notificar } from "../_shared/notify.ts"`

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export type NotifTarget =
  | { userIds: string[] }
  | { membroIds: string[] };

export type NotifPayload = {
  tipo: string;            // 'escala' | 'sos' | 'grupo_pedido' | ...
  titulo: string;
  body: string;
  data?: Record<string, unknown>;  // ids, deeplink, etc.
  sound?: "default" | null;
};

export function makeAdmin(): SupabaseClient {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

/** Resolve membro_id -> user_id via profiles. */
async function membrosParaUsuarios(
  sb: SupabaseClient,
  membroIds: string[]
): Promise<string[]> {
  if (!membroIds.length) return [];
  const { data } = await sb
    .from("profiles")
    .select("id")
    .in("membro_id", membroIds);
  return (data ?? []).map((p) => p.id as string);
}

/** Busca tokens distintos para uma lista de user_id. */
async function tokensDeUsuarios(
  sb: SupabaseClient,
  userIds: string[]
): Promise<{ user_id: string; token: string }[]> {
  if (!userIds.length) return [];
  const { data } = await sb
    .from("app_push_tokens")
    .select("user_id, token")
    .in("user_id", userIds);
  return (data ?? []) as { user_id: string; token: string }[];
}

/**
 * Envia uma notificação:
 *  - resolve targets pra user_id
 *  - grava 1 linha em app_notificacoes por user_id (mesmo sem token)
 *  - dispara push pra cada token via Expo Push API
 */
export async function notificar(
  target: NotifTarget,
  payload: NotifPayload
): Promise<{ enviados: number; persistidos: number }> {
  const sb = makeAdmin();

  const userIds =
    "userIds" in target
      ? target.userIds
      : await membrosParaUsuarios(sb, target.membroIds);
  if (!userIds.length) return { enviados: 0, persistidos: 0 };

  // 1) persiste no histórico (1 por user)
  const rows = userIds.map((u) => ({
    user_id: u,
    tipo: payload.tipo,
    titulo: payload.titulo,
    body: payload.body,
    data: payload.data ?? {},
  }));
  await sb.from("app_notificacoes").insert(rows);

  // 2) envia push pra cada token
  const tokens = await tokensDeUsuarios(sb, userIds);
  if (!tokens.length) return { enviados: 0, persistidos: rows.length };

  const messages = tokens.map((t) => ({
    to: t.token,
    // som elegante da marca (bundlado via expo-notifications); Android usa o
    // canal "default" configurado no app (lib/push.ts) com o mesmo som.
    sound: payload.sound === null ? undefined : "cbrio-chime.wav",
    channelId: "default",
    title: payload.titulo,
    body: payload.body,
    data: { tipo: payload.tipo, ...(payload.data ?? {}) },
  }));

  try {
    await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(messages),
    });
  } catch (e) {
    console.log("[notify] erro Expo Push:", e);
  }

  return { enviados: messages.length, persistidos: rows.length };
}
