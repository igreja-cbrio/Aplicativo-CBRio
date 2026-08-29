// ════════════════════════════════════════════════════════════════════════════
//  "Hoje tem Kids, e eu tenho filho lá?" — a régua PURA do card da Home
//
//  Pedido do Matheus (29/08/2026): *"dias de culto aparecer um card assim na
//  tela principal, para os pais de crianças do kids poderem fazer o pré
//  check-in de forma mais rápida."*
//
//  ⚠️⚠️ O recurso JÁ EXISTIA e ninguém achava. Medido em 29/08: **1 pré-check-in
//  na história inteira** contra **888 check-ins no totem em 30 dias**. A tela
//  `/kids` funciona; o que faltava era ela ser alcançável no dia em que serve.
//
//  ⚠️ A condição sai do que a Home JÁ CARREGA (`proximosCultos(7)` traz `data`
//  em BRT e `has_kids` do tipo de culto) — nenhuma consulta nova pra decidir se
//  o card aparece.
// ════════════════════════════════════════════════════════════════════════════

export type CultoDoDia = { data: string; has_kids?: boolean | null; hora?: string | null };

/**
 * Tem culto COM KIDS hoje?
 *
 * ⚠️ `has_kids` vem de `vol_service_types` e é **nullable**: culto de tipo que
 * não declara nada NÃO conta. Tratar null como "tem" faria o card aparecer em
 * dia de AMI/Bridge, mandando o pai gerar um código que ninguém vai ler.
 */
export function temKidsHoje(cultos: CultoDoDia[] | null | undefined, hojeISO: string): boolean {
  if (!Array.isArray(cultos) || !hojeISO) return false;
  return cultos.some((c) => c?.data === hojeISO && c?.has_kids === true);
}

/**
 * "Laura e Miguel" — o rótulo dos filhos no card.
 *
 * ⚠️ Teto de 2 nomes: no cartão o texto tem uma linha. Família com 3+ vira
 * "Laura, Miguel +1" em vez de estourar ou cortar no meio de um nome.
 */
export function rotuloFilhos(nomes: (string | null | undefined)[]): string {
  const limpos = (nomes || []).map((n) => (n || "").trim().split(/\s+/)[0]).filter(Boolean);
  if (limpos.length === 0) return "";
  if (limpos.length === 1) return limpos[0];
  if (limpos.length === 2) return `${limpos[0]} e ${limpos[1]}`;
  return `${limpos[0]}, ${limpos[1]} +${limpos.length - 2}`;
}

/**
 * O código de pré-check-in ainda vale?
 *
 * ⚠️ FAIL-CLOSED: sem `expira_em` legível, trata como VENCIDO. Mostrar um código
 * morto como pronto faria o pai chegar no totem com um papel que não abre nada
 * — pior que não mostrar código nenhum.
 */
export function codigoValido(pre: { codigo?: string | null; expira_em?: string | null } | null | undefined, agoraMs: number): boolean {
  if (!pre?.codigo) return false;
  const fim = Date.parse(pre.expira_em || "");
  if (!Number.isFinite(fim)) return false;
  return fim > agoraMs;
}
