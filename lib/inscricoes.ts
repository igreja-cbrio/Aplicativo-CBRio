import { criarInscricaoApi } from "./api";

/**
 * Inscrições do app vão pelo endpoint genérico do backend CBRio:
 *   POST https://cbrio.org/api/app/inscricoes
 * O corpo é JSON plano com `tipo` no nível raiz + os demais campos juntos.
 * O backend cria o registro em app_inscricoes (e dispara as triggers que
 * preenchem as tabelas finais).
 *
 * NÃO inserir direto na tabela pelo cliente Supabase.
 */
export type TipoInscricao =
  | "batismo"
  | "grupo"        // legado — algumas telas ainda usam "grupo" singular
  | "grupos"       // novo nome canônico do backend
  | "next"
  | "voluntariado"
  | "oracao"
  | "aconselhamento"
  | "sos"
  | "contato";

export async function criarInscricao(
  tipo: TipoInscricao,
  dados: Record<string, unknown>,
  _authUserId?: string | null
) {
  const tipoFinal = tipo === "grupo" ? "grupos" : tipo;
  await criarInscricaoApi({ tipo: tipoFinal, ...dados } as Record<string, unknown> & { tipo: string });
}
