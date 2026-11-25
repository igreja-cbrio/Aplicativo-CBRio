/**
 * Trecho bíblico de um comentário (25/11/2026). Pedido do Marcos: o comentário
 * mostrava só a referência; agora mostra o texto que a pessoa selecionou. Um
 * capítulo inteiro vira um card enorme, então todo trecho acima do limite sai
 * cortado (no fim de uma palavra, com "…") e o "Ver mais" expande. Assim os
 * cards da lista ficam do mesmo tamanho.
 */
export const LIMITE_TRECHO = 240;

export function resumirTrecho(texto: string | null | undefined, limite = LIMITE_TRECHO): { curto: string; cortado: boolean } {
  const limpo = (texto ?? "").replace(/\s+/g, " ").trim();
  if (limpo.length <= limite) return { curto: limpo, cortado: false };
  const corte = limpo.slice(0, limite);
  const ultimoEspaco = corte.lastIndexOf(" ");
  // Sem espaço razoável (palavra gigante), corta seco no limite.
  const base = ultimoEspaco > limite * 0.6 ? corte.slice(0, ultimoEspaco) : corte;
  return { curto: base.replace(/[\s,;:.—–-]+$/, "") + "…", cortado: true };
}
