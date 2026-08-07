// Helper compartilhado entre as Edge Functions de notificação.
// - busca tokens de push de um conjunto de user_id ou membro_id
// - dispara via Expo Push API
// - grava em app_notificacoes (histórico no app)
//
// Import: `import { notificar } from "../_shared/notify.ts"`

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
// ⚠️ Régua PURA compartilhada com o app (e coberta pelo gate: `npm run verificar`
// roda 12 testes só dela). Ela decide como o lote é partido — se errar, a Expo
// recusa o request inteiro, que é exatamente o defeito de 1.801 tickets.
import { lotesDePush, tokenMorreu } from "../../../lib/pushLotes.ts";

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

type LinhaToken = { user_id: string; token: string; platform?: string | null; projeto_id?: string | null };

/**
 * Busca tokens distintos para uma lista de user_id.
 *
 * ⚠️ `.in()` em LOTES de 200: a lista inteira estoura a URL do PostgREST e a
 * query falha por completo (mesma lição do `.in()` gigante da Onda 1). E a
 * leitura é PAGINADA porque o PostgREST capa em 1.000 linhas **sem erro** —
 * a partir de ~1.000 instalações o broadcast alcançaria só o primeiro pedaço
 * da base e nenhum log acusaria. O ERP já tinha essa régua
 * (`services/appPush.js`); aqui não tinha.
 */
async function tokensDeUsuarios(
  sb: SupabaseClient,
  userIds: string[]
): Promise<LinhaToken[]> {
  if (!userIds.length) return [];
  const LOTE_IN = 200;
  const PAGINA = 1000;
  const out: LinhaToken[] = [];

  for (let i = 0; i < userIds.length; i += LOTE_IN) {
    const fatia = userIds.slice(i, i + LOTE_IN);
    for (let de = 0; ; de += PAGINA) {
      const { data, error } = await sb
        .from("app_push_tokens")
        .select("user_id, token, platform, projeto_id")
        .in("user_id", fatia)
        .range(de, de + PAGINA - 1);
      if (error) {
        // ⚠️ Coluna `projeto_id` ainda não existe (migration não aplicada): o
        // PostgREST derruba a query INTEIRA por uma coluna desconhecida, e sem
        // este resgate o push pararia em vez de só perder o agrupamento.
        const semColuna = /projeto_id/i.test(String(error.message ?? ""));
        if (!semColuna) {
          console.log("[notify] erro ao ler tokens:", error.message);
          return out;
        }
        const r = await sb
          .from("app_push_tokens")
          .select("user_id, token, platform")
          .in("user_id", fatia)
          .range(de, de + PAGINA - 1);
        const linhas = (r.data ?? []) as LinhaToken[];
        out.push(...linhas);
        if (linhas.length < PAGINA) break;
        continue;
      }
      const linhas = (data ?? []) as LinhaToken[];
      out.push(...linhas);
      if (linhas.length < PAGINA) break;
    }
  }
  return out;
}

/** Recorta pro shape que a tabela de tickets aceita. */
function plataformaDe(p: unknown): string {
  const s = String(p ?? "").toLowerCase();
  return s === "ios" || s === "android" ? s : "unknown";
}

function texto(v: unknown, max = 500): string | null {
  return v == null ? null : String(v).replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max) || null;
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

  // ⚠️⚠️ AGRUPA POR APP EXPO ANTES DE ENVIAR (07/08/2026) — ver `lib/pushLotes.ts`.
  // Aqui era UM fetch com TODAS as mensagens, e a resposta era jogada fora
  // (`await fetch(...)` sem ler o corpo). Duas consequências somadas:
  //   · a Expo recusava o request inteiro por misturar dois apps Expo na mesma
  //     chamada (1.801 de 1.820 tickets em erro — 98,9%);
  //   · e ninguém sabia, porque o corpo nunca era lido nem gravado.
  // Sem chunk também: acima de 100 mensagens a Expo recusa por tamanho.
  const lotes = lotesDePush(tokens);
  const porToken = new Map(tokens.map((t) => [t.token, t]));

  let aceitos = 0;
  const mortos: string[] = [];

  for (const lote of lotes) {
    const messages = lote.map((t) => ({
      to: t.token,
      // som elegante da marca (bundlado via expo-notifications); Android usa o
      // canal "default" configurado no app (lib/push.ts) com o mesmo som.
      sound: payload.sound === null ? undefined : "cbrio_chime.wav",
      channelId: "default",
      title: payload.titulo,
      body: payload.body,
      data: { tipo: payload.tipo, ...(payload.data ?? {}) },
    }));

    try {
      const resp = await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(messages),
      });
      // ⚠️ QUEM CONTA A VERDADE É O CORPO: a Expo devolve 200 com tickets de
      // erro dentro. Ler só o `resp.ok` foi o que escondeu isto por 2 meses.
      const corpo = await resp.json().catch(() => ({} as Record<string, unknown>));
      const tickets = Array.isArray((corpo as { data?: unknown }).data)
        ? ((corpo as { data: Record<string, unknown>[] }).data)
        : [];
      const erroGeral = (corpo as { errors?: { code?: string; message?: string }[] }).errors?.[0];

      const linhas = lote.map((t, i) => {
        const tk = (tickets[i] ?? {}) as { status?: string; id?: string; message?: string; details?: { error?: string } };
        const ok = resp.ok && tk.status === "ok" && !!tk.id;
        if (ok) aceitos += 1;
        const code = tk.details?.error ?? erroGeral?.code ?? `HTTP_${resp.status}`;
        if (!ok && tokenMorreu(code)) mortos.push(t.token);
        return {
          provider: "expo",
          provider_ticket_id: ok ? texto(tk.id, 160) : null,
          platform: plataformaDe(porToken.get(t.token)?.platform),
          ticket_status: ok ? "accepted" : "error",
          ticket_error_code: ok ? null : texto(code, 120),
          ticket_error_message: ok ? null : texto(tk.message ?? erroGeral?.message),
        };
      });
      await sb.from("system_mobile_push_tickets").insert(linhas);
    } catch (e) {
      console.log("[notify] erro Expo Push:", e);
      await sb.from("system_mobile_push_tickets").insert(
        lote.map((t) => ({
          provider: "expo",
          platform: plataformaDe(porToken.get(t.token)?.platform),
          ticket_status: "error",
          ticket_error_code: "NETWORK_ERROR",
          ticket_error_message: texto((e as Error)?.message),
        })),
      );
    }
  }

  // ⚠️ SÓ `DeviceNotRegistered` some (app desinstalado). Apagar por erro de
  // LOTE teria zerado a tabela: 1.773 tickets traziam
  // `PUSH_TOO_MANY_EXPERIENCE_IDS`, e a culpa era do request, não do token.
  if (mortos.length) {
    await sb.from("app_push_tokens").delete().in("token", mortos);
  }

  return { enviados: aceitos, persistidos: rows.length };
}
