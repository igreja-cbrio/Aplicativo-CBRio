import { apiGet } from "./api";

/**
 * Temporada de inscrição em grupos + grupos inscritíveis. A fonte é o BACKEND
 * (GET /public/grupos/app-inscricao), que aplica a MESMA régua do formulário
 * público do site (grupo ativo, aceitando inscrições, não fechado/pausado,
 * temporada aberta ou modo sempre_aberto).
 *
 * ⚠️ NÃO voltar a ler a tabela `app_grupos_temporada` (paralela e órfã — dizia
 * "fechada" com a temporada aberta) nem `mem_grupos` direto (perde as travas).
 */
export type GrupoInscricao = {
  id: string;
  codigo: string | null;
  nome: string;
  categoria: string | null;
  bairro: string | null;
  dia_semana: number | null; // 0 = domingo (0 é falsy — comparar com != null)
  horario: string | null; // "HH:MM:SS"
  recorrencia: string | null;
  modo_inscricao: string | null;
};

export type TemporadaGrupos = {
  aberta: boolean;
  titulo: string | null;
  grupos: GrupoInscricao[];
  /**
   * ⚠️ A consulta FALHOU (rede, timeout, 429) — `aberta: false` aqui NÃO
   * significa "temporada fechada", significa "não consegui perguntar". A tela
   * tem que dizer "não carregou · tentar de novo", nunca "inscrições fechadas".
   */
  falhou?: boolean;
};

export async function getTemporadaGrupos(): Promise<TemporadaGrupos> {
  try {
    const data = await apiGet<TemporadaGrupos>("/public/grupos/app-inscricao", {
      auth: false,
    });
    return {
      aberta: !!data?.aberta,
      titulo: data?.titulo ?? null,
      grupos: Array.isArray(data?.grupos) ? data.grupos : [],
    };
  } catch {
    // ⚠️⚠️ ANTES devolvia `{ aberta: false }` "por segurança" — e a tela dizia
    // **"inscrições fechadas"** por causa de um timeout. Fail-closed protege
    // PERMISSÃO; isto é LEITURA DE ESTADO, e aqui ele não protege nada: só faz
    // a pessoa desistir de se inscrever numa temporada que está aberta.
    // `falhou: true` deixa a tela dizer "não carregou · tentar de novo".
    return { aberta: false, titulo: null, grupos: [], falhou: true };
  }
}
