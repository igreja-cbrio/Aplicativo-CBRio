// ============================================================================
// VOLUNTARIADO · régua ÚNICA de status (05/08/2026)
//
// `vol_inscricoes.status` tem SETE valores no ERP (VolInscricoes.tsx do sistema
// é a fonte: integrado · enviado_ministerio · inscrito · kids · nao_responde ·
// nao_pode_ou_duplicata · desistente) e o app tratava TRÊS. Medido em produção
// em 05/08: `integrado` 575 · `inscrito` 80 · `enviado_ministerio` 68 ·
// **`nao_responde` 69 · `nao_pode_ou_duplicata` 19 · `kids` 3**. Ou seja, 91
// linhas caíam em lugar nenhum — e o pior era a DIVERGÊNCIA na mesma tela:
//
//   · o hub de Inscrições fazia `status === "integrado" ? "ativo" : "pendente"`
//     → quem foi encerrado pela equipe (`nao_responde`) via **"Pendente"**, como
//     se ainda estivesse na fila;
//   · a tela de Servir só reconhecia inscrito/enviado_ministerio/integrado, então
//     a MESMA pessoa caía no `else` e via o **formulário de inscrição**.
//
// Duas verdades sobre o mesmo dado, na mesma abertura do app. É a classe de bug
// do `"recusado"` que nunca existiu em `mem_grupo_pedidos`: comparar string
// contra enum do banco sem uma régua única.
//
// ⚠️ Status novo no ERP entra AQUI (e só aqui). Desconhecido → 'nenhum', que é
// o estado que deixa a pessoa agir (ver o formulário) em vez de travá-la num
// "pendente" que ninguém está tratando.
// ============================================================================

/** Como o app resume a situação da pessoa no valor Servir. */
export type EstadoVoluntariado = "ativo" | "pendente" | "nenhum";

/**
 * ATIVO = está servindo (ou já foi alocada num ministério).
 * `kids` é alocação no ministério Kids — o ERP conta como "alocada" no KPI
 * `solicitacoes_servir_alocadas`, junto de enviado_ministerio/integrado.
 */
const ATIVO = new Set(["integrado", "kids"]);

/** PENDENTE = a fila da equipe ainda está com a pessoa. */
const PENDENTE = new Set(["inscrito", "enviado_ministerio"]);

/**
 * ENCERRADO pela equipe. Vira 'nenhum' de propósito: o dedup do backend só
 * bloqueia `inscrito`/`enviado_ministerio` (M6a), então a pessoa PODE se
 * inscrever de novo — e é isso que a tela deve oferecer.
 */
const ENCERRADO = new Set(["nao_responde", "nao_pode_ou_duplicata", "desistente"]);

export function estadoVoluntariado(
  status: string | null | undefined,
  voluntarioAtivo?: boolean | null
): EstadoVoluntariado {
  // A flag `mem_membros.voluntario` cobre o voluntário antigo (backfill) que não
  // tem inscrição — se ela diz que serve, serve.
  if (voluntarioAtivo === true) return "ativo";
  const s = (status || "").trim();
  if (!s) return "nenhum";
  if (ATIVO.has(s)) return "ativo";
  if (PENDENTE.has(s)) return "pendente";
  if (ENCERRADO.has(s)) return "nenhum";
  // Status que o ERP criou e ninguém trouxe pra cá: não inventa "pendente".
  return "nenhum";
}

/** A equipe encerrou a fila desta pessoa (a tela avisa antes de reoferecer). */
export function volEncerrado(status: string | null | undefined): boolean {
  return ENCERRADO.has((status || "").trim());
}
