// Guarda compartilhada das Edge Functions notify-* (auditoria de segurança
// de 19/11/2026). Essas funções são chamadas SOMENTE por webhooks do banco
// (pg_net/pg_cron) e pelo backend do cbrio.org — nunca pelo app do membro.
// Antes desta guarda, qualquer pessoa com a chave pública (anon) do projeto
// conseguia disparar pushes falsos para membros, líderes e pastores.
//
// Aceita DUAS credenciais server-side (qualquer uma basta):
//   1. Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>  (backend cbrio.org)
//   2. x-notify-secret: <NOTIFY_WEBHOOK_SECRET>           (pg_net / pg_cron)
// Fail-closed de propósito: sem credencial válida a chamada morre em 401 —
// se o segredo não estiver configurado no ambiente, NINGUÉM chama.

function timingSafeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const ba = enc.encode(a);
  const bb = enc.encode(b);
  if (ba.length !== bb.length) return false;
  let diff = 0;
  for (let i = 0; i < ba.length; i++) diff |= ba[i]! ^ bb[i]!;
  return diff === 0;
}

/** null = autorizado; Response 401 = rejeitada. */
export function rejeitarSeNaoAutorizado(req: Request): Response | null {
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const auth = req.headers.get("authorization") ?? "";
  if (serviceKey && timingSafeEqual(auth, `Bearer ${serviceKey}`)) return null;

  const segredo = Deno.env.get("NOTIFY_WEBHOOK_SECRET") ?? "";
  const recebido = req.headers.get("x-notify-secret") ?? "";
  if (segredo && timingSafeEqual(recebido, segredo)) return null;

  return new Response("não autorizado", { status: 401 });
}
