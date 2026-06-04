import { apiGet, criarInscricaoApi } from "./api";

/** GET /api/grupos/meu — grupos que participo/lidero + meus pedidos pendentes. */
export async function meusGrupos() {
  return apiGet("/grupos/meu");
}

/**
 * Pedido para entrar em um grupo. Usa o endpoint genérico de inscrições
 * (tipo:"grupos"), que internamente cria mem_grupo_pedidos e notifica o
 * líder. Sem grupo_id o backend recusa. 409 = já tem pedido ou já participa.
 */
export async function pedirEntrarGrupo(
  grupoId: string,
  body: { membro_id: string; nome: string; telefone?: string | null; email?: string | null }
) {
  try {
    return await criarInscricaoApi({
      tipo: "grupos",
      grupo_id: grupoId,
      membro_id: body.membro_id,
      nome: body.nome,
      telefone: body.telefone ?? "",
      email: body.email ?? "",
    });
  } catch (e) {
    const err = e as Error & { status?: number; code?: number };
    if (err.status === 409) {
      err.code = 409;
      err.message = "Você já tem um pedido neste grupo ou já participa.";
    }
    throw err;
  }
}
