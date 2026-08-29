// ════════════════════════════════════════════════════════════════════════════
//  "Esta notificação tem botão? Qual?" — ESPELHO da régua do servidor
//
//  Pedido do Matheus (29/08/2026): *"nas notificações queria as notificações
//  dentro do app chegassem com botão para confirmar ou pedir troca (quando a
//  pessoa não puder ir). Pedidos para entrar em grupo também. Claro que se
//  clicar fora dos botões, deve direcionar para a rota respectiva."*
//
//  ⚠️⚠️ ESPELHO EXATO de `backend/utils/acaoNotificacao.js` (ERP). Mudou lá,
//  muda aqui. Divergir tem dois estragos e os dois já morderam este sistema:
//  o app oferece um botão que o servidor recusa (400 na cara da pessoa), ou
//  esconde um que funcionaria.
// ════════════════════════════════════════════════════════════════════════════

/** Teto de escalas numa mesma notificação: o aviso agrupa por (pessoa, DIA) e o
 *  dia mais cheio tem 4 cultos. 8 é folga, não expectativa. */
export const MAX_ESCALAS = 8;

export type AcaoNotificacao = "confirmar" | "nao_posso" | "aprovar" | "recusar";

export type AcoesDisponiveis = {
  acoes: AcaoNotificacao[];
  /** Ação já registrada (o card vira desfecho, sem botão). */
  feita: string | null;
  escalaIds?: string[];
  pedidoId?: string;
};

function ids(valor: unknown): string[] {
  if (!Array.isArray(valor)) return [];
  const vistos = new Set<string>();
  for (const v of valor) {
    if (typeof v === "string" && v.trim()) vistos.add(v.trim());
    if (vistos.size >= MAX_ESCALAS) break;
  }
  return [...vistos];
}

/**
 * ⚠️ **Sem ALVO, sem botão.** As notificações de escala anteriores a 29/08 têm
 * `data = {tipo:'escala'}` — não há id pra responder, e inventar um responderia
 * pela escala errada. Elas seguem abrindo a tela no toque, como sempre.
 *
 * ⚠️ Já respondida vira DESFECHO: sem isso a pessoa toca de novo, o servidor
 * responde "já estava assim" e ela conclui que o app não gravou.
 */
export function acoesDaNotificacao(tipo: string, data: unknown): AcoesDisponiveis {
  const d = (data && typeof data === "object" ? data : {}) as Record<string, unknown>;
  if (d.acao) return { acoes: [], feita: String(d.acao) };

  if (tipo === "escala") {
    const escalaIds = ids(d.escala_ids);
    if (!escalaIds.length) return { acoes: [], feita: null };
    return { acoes: ["confirmar", "nao_posso"], feita: null, escalaIds };
  }

  if (tipo === "grupo_pedido") {
    const pedidoId = typeof d.pedido_id === "string" && d.pedido_id.trim() ? d.pedido_id.trim() : undefined;
    if (!pedidoId) return { acoes: [], feita: null };
    return { acoes: ["aprovar", "recusar"], feita: null, pedidoId };
  }

  return { acoes: [], feita: null };
}

/**
 * O rótulo do botão.
 *
 * ⚠️⚠️ "Pedir troca" é RÓTULO — o fato gravado é `declined` ("não vou poder"),
 * que avisa a coordenação e o supervisor pra REPOR a vaga. O sistema não
 * procura substituto sozinho, e o texto de confirmação diz isso: prometer troca
 * automática seria a tela afirmando o que o produto não faz.
 */
export function rotuloAcao(acao: AcaoNotificacao): string {
  switch (acao) {
    case "confirmar": return "Confirmar presença";
    case "nao_posso": return "Pedir troca";
    case "aprovar":   return "Aprovar";
    case "recusar":   return "Recusar";
  }
}

/** O desfecho, em texto, pro card de quem já respondeu. */
export function rotuloFeito(feita: string): string {
  switch (feita) {
    case "confirmar": return "Presença confirmada";
    case "nao_posso": return "Você avisou que não vai poder";
    case "aprovar":   return "Pedido aprovado";
    case "recusar":   return "Pedido devolvido pra equipe";
    default:          return "Respondido";
  }
}

/** Botão de peso (preenchido) × secundário. O primeiro da lista é o principal. */
export function ehAcaoPrincipal(acao: AcaoNotificacao): boolean {
  return acao === "confirmar" || acao === "aprovar";
}
