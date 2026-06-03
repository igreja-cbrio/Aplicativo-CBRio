import { supabase } from "./supabase";

/**
 * Inscrições do app gravam na tabela genérica `app_inscricoes`
 * (tipo + dados jsonb). O SISTEMA_INTEGRADO_CBRIO processa essas inscrições
 * para as tabelas finais (batismo_inscricoes, next_inscricoes, vol_inscricoes…).
 */
export type TipoInscricao =
  | "batismo"
  | "grupo"
  | "next"
  | "voluntariado"
  | "oracao"
  | "aconselhamento"
  | "sos";

export async function criarInscricao(
  tipo: TipoInscricao,
  dados: Record<string, unknown>,
  authUserId?: string | null
) {
  const { error } = await supabase.from("app_inscricoes").insert({
    tipo,
    auth_user_id: authUserId ?? null,
    dados,
    status: "pendente",
  });
  if (error) throw error;
}
