// ============================================================================
// COMO PARTIR O LOTE DE PUSH · a régua (07/08/2026)
//
// ⚠️⚠️ ISTO EXISTE PORQUE **NENHUMA NOTIFICAÇÃO PUSH JAMAIS FOI ENTREGUE**.
// Medido em `system_mobile_push_tickets` (07/08):
//     1.820 tickets · `ticket_status='ok'` → **ZERO** · `'error'` → 1.801
//     `PUSH_TOO_MANY_EXPERIENCE_IDS` → 1.773 · o mais recente HOJE, 20:02
//
// A Expo devolve, literalmente: "All push notification messages in the same
// request must be for the same project." A tabela `app_push_tokens` recebe
// token de DOIS apps Expo (o de membros e o CBRio Staff — mesma org, mesmo
// Supabase), e os remetentes juntavam tudo num request só.
//
// ⚠️⚠️ O DETALHE QUE FAZ ISSO SER TÃO CARO: a Expo recusa **o request inteiro**,
// não as linhas estranhas. Um único token de outro app derrubava a entrega de
// TODOS os outros — por isso o iOS também nunca recebeu nada, apesar dos 30
// tokens perfeitamente válidos. Não é degradação parcial: é tudo ou nada.
//
// ⚠️ E ninguém viu porque os dois remetentes eram cegos de jeitos diferentes:
// a Edge Function (`_shared/notify.ts`) dava `await fetch(...)` **sem ler o
// corpo**, e o ERP (`services/appPush.js`) lia e gravava ticket — mas ninguém
// olhava a tabela de tickets.
// ============================================================================

/** Teto de mensagens por request da Expo Push API. */
export const MAX_POR_REQUEST = 100;

export type TokenPush = {
  token: string;
  /** projectId do EAS que emitiu o token. NULL/vazio = app que ainda não carimba. */
  projeto_id?: string | null;
};

/** Projeto normalizado, ou `null` quando desconhecido. */
function projetoDe(t: TokenPush): string | null {
  const p = typeof t.projeto_id === "string" ? t.projeto_id.trim() : "";
  return p || null;
}

/**
 * Parte a lista de tokens em REQUESTS que a Expo aceita.
 *
 * Duas regras, e as duas têm custo se erradas:
 *
 *  1. **Nunca misturar projetos no mesmo request.** É a causa dos 1.773 erros.
 *  2. **Token de projeto DESCONHECIDO vai sozinho** — um request com uma
 *     mensagem só não tem como ter "experience ids demais". É o que mantém a
 *     entrega correta **desde o primeiro envio**, sem precisar adivinhar de
 *     qual app veio o token antigo e sem apagar linha de ninguém.
 *
 * ⚠️ Por que não juntar todos os desconhecidos num lote só: eles são
 * exatamente os tokens de origem AMBÍGUA — é a mistura mais provável de todas.
 * Agrupá-los reproduziria o bug com outro nome.
 *
 * ⚠️ Isto se cura sozinho: o app de membros reescreve o próprio token a cada
 * volta do background, então os desconhecidos viram carimbados em poucos dias
 * e voltam pro lote de 100. O caminho de 1-por-request é transição, não regime.
 *
 * Devolve os tokens agrupados, na ordem: projetos conhecidos primeiro
 * (determinístico, ordenado pelo id), desconhecidos por último.
 */
export function lotesDePush(
  tokens: TokenPush[] | null | undefined,
  maxPorRequest: number = MAX_POR_REQUEST,
): TokenPush[][] {
  if (!Array.isArray(tokens) || !tokens.length) return [];

  const teto = Number.isFinite(maxPorRequest) && maxPorRequest >= 1
    ? Math.floor(maxPorRequest)
    : MAX_POR_REQUEST;

  // ⚠️ Dedupe por TOKEN: o mesmo aparelho pode aparecer 2× (a chave primária é
  // o token, mas a leitura vem de várias fatias de `.in()` e podia repetir).
  // Mandar duas vezes gera duas notificações na bandeja da mesma pessoa.
  const vistos = new Set<string>();
  const porProjeto = new Map<string, TokenPush[]>();
  const desconhecidos: TokenPush[] = [];

  for (const t of tokens) {
    const tok = typeof t?.token === "string" ? t.token.trim() : "";
    if (!tok || vistos.has(tok)) continue;
    vistos.add(tok);

    const proj = projetoDe(t);
    if (proj === null) {
      desconhecidos.push({ ...t, token: tok });
      continue;
    }
    const lista = porProjeto.get(proj) ?? [];
    lista.push({ ...t, token: tok });
    porProjeto.set(proj, lista);
  }

  const lotes: TokenPush[][] = [];
  for (const proj of [...porProjeto.keys()].sort()) {
    const lista = porProjeto.get(proj)!;
    for (let i = 0; i < lista.length; i += teto) lotes.push(lista.slice(i, i + teto));
  }
  // Um por request — ver o cabeçalho da função.
  for (const t of desconhecidos) lotes.push([t]);

  return lotes;
}

/**
 * Este ticket de erro merece apagar o token?
 *
 * ⚠️ SÓ `DeviceNotRegistered`. É o único que a Expo define como permanente (o
 * app foi desinstalado ou a permissão foi revogada) e o único que se conserta
 * apagando a linha. Todos os outros são de LOTE ou transitórios:
 * `PUSH_TOO_MANY_EXPERIENCE_IDS` culpa o request, não o token, e apagar por
 * causa dele teria zerado a tabela inteira — 30 pessoas perdendo push por um
 * defeito que não era delas.
 */
export function tokenMorreu(errorCode: string | null | undefined): boolean {
  return String(errorCode ?? "").trim() === "DeviceNotRegistered";
}
