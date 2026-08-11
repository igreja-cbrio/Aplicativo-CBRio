// ============================================================================
// QUAL CULTO FICA EM CIMA NA HOME (11/08/2026 · apontamento 9, 3ª rodada)
//
// Palavras do Marcos: *"a lógica do culto mais próximo ficar maior é boa, mas o
// culto de domingo tem muitos horários e fica feio pois ele passa. Coloque o
// culto de domingo sempre em cima para os horários ficarem certos; apenas em
// horário de culto coloque uma tarja acima dos cultos dizendo culto ao vivo
// para clicar com link."*
//
// ⚠️⚠️ O QUE MUDOU E POR QUÊ: o destaque era o PRÓXIMO culto, então ele trocava
// de lugar ao longo da semana — e o de domingo, que tem 4 horários, ora subia
// ora descia, remontando o bloco inteiro. Agora o domingo é ÂNCORA: fica sempre
// em cima, com todos os horários dele juntos e na mesma ordem.
//
// ⚠️ E o "ao vivo" deixou de ser um estado do CARD pra virar uma TARJA acima de
// tudo. É o que separa as duas perguntas que a pessoa faz: "quando é o culto?"
// (o card, estável) e "tem culto agora?" (a tarja, que só aparece na hora).
// ============================================================================

/** O que a Home precisa saber de cada bloco de culto pra se organizar. */
export type BlocoCulto = { data: string };

/**
 * A data ISO (`AAAA-MM-DD`) cai num domingo?
 *
 * ⚠️ Monta a data ao MEIO-DIA local. `new Date("2026-08-16")` é interpretado
 * como UTC pelo JS e, no fuso do Brasil (UTC-3), volta como **sábado 21h** — o
 * domingo simplesmente não seria reconhecido. Meio-dia é longe o bastante das
 * duas bordas pra nenhum fuso do país mudar o dia.
 */
export function ehDomingo(dataIso: string | null | undefined): boolean {
  const s = String(dataIso ?? "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T12:00:00`);
  return !Number.isNaN(d.getTime()) && d.getDay() === 0;
}

/**
 * Índice do bloco que fica em CIMA (o retângulo grande).
 *
 * Regra: o domingo, sempre. Sem domingo na lista, o primeiro — que é o próximo,
 * porque a lista já vem ordenada por data.
 *
 * ⚠️ Devolve ÍNDICE e não o objeto: quem chama precisa remover exatamente esse
 * item da grade de baixo, e remover por referência falharia se dois blocos
 * fossem iguais em conteúdo.
 */
export function indiceDoDestaque(blocos: BlocoCulto[] | null | undefined): number {
  if (!Array.isArray(blocos) || !blocos.length) return -1;
  const domingo = blocos.findIndex((b) => ehDomingo(b?.data));
  return domingo >= 0 ? domingo : 0;
}
