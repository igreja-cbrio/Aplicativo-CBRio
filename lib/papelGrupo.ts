// ============================================================================
// PAPEL NO GRUPO · qual tela abrir (07/08/2026)
//
// Decisão do Marcos: o SUPERVISOR ganha uma tela enxuta — "apenas Registrar
// Frequência e comentários sobre aquele grupo… não precisa ver estudos, pedidos
// de aprovação". Quem LIDERA continua com a tela completa de gestão.
//
// ⚠️⚠️ QUEM DECIDE O PAPEL É O SERVIDOR (`papel` em `/app/grupos/meus`,
// `meu_papel` no roster). O app NÃO cruza ids de `grupos_liderados` ×
// `grupos_supervisionados` — régua duplicada entre app e ERP é literalmente a
// classe de bug que a varredura de 05/08 encontrou nove vezes.
//
// ⚠️ E a precedência importa: medido em 07/08, **7 dos 87 grupos ativos têm
// `supervisor_id == lider_id`**. Nesses, LIDERAR GANHA — senão o líder perderia
// Pedidos, Estudos e Editar do próprio grupo.
//
// ⚠️⚠️ ESCONDER ABA NÃO TIRA PODER. O servidor autoriza líder E supervisor nos
// mesmos ~8 endpoints de gerenciar grupo (mudar função, tirar do grupo,
// transferir, editar, aprovar pedido) — foi assim que a Onda 1b deu ao
// supervisor o save que ele não tinha. Esta régua é de NAVEGAÇÃO, não é trava
// de segurança; se um dia a decisão for "supervisor só vê", a régua tem que
// subir pro servidor também.
// ============================================================================

export type PapelGrupo = "lider" | "supervisor" | "admin" | "nenhum";

export const ROTA_GESTAO = "/grupo-membros" as const;
export const ROTA_VISITA = "/grupo-visita" as const;

export type RotaGrupo = typeof ROTA_GESTAO | typeof ROTA_VISITA;

/**
 * Para onde o toque no grupo leva.
 *
 * ⚠️ Papel desconhecido/ausente cai na tela COMPLETA de propósito: é o
 * comportamento que já existia, então bundle novo contra servidor antigo (ou o
 * contrário) não muda nada pra ninguém. Mandar pra tela enxuta no escuro
 * ESCONDERIA funcionalidade do líder — o erro caro é esse, não o inverso.
 */
export function rotaDoGrupo(papel: PapelGrupo | string | null | undefined): RotaGrupo {
  return papel === "supervisor" ? ROTA_VISITA : ROTA_GESTAO;
}

/** É supervisão pura (nem lidera, nem é da coordenação)? */
export function ehSupervisao(papel: PapelGrupo | string | null | undefined): boolean {
  return papel === "supervisor";
}
