import { supabase } from "./supabase";
import { meuBatismo } from "./batismo";
import { getVoluntariadoMe, getNextMe } from "./api";

export type StatusInscricao = "nenhum" | "pendente" | "ativo";

export type InscricoesStatus = {
  batismo: StatusInscricao;
  grupos: StatusInscricao;
  next: StatusInscricao;
  voluntariado: StatusInscricao;
};

/**
 * Estado consolidado das inscrições do membro pra mostrar "já inscrito /
 * pendente" na tela de Inscrições. Cada fonte é independente e tolerante
 * a falha (cai em "nenhum" se a consulta falhar).
 */
export async function carregarStatusInscricoes(membroId: string | null): Promise<InscricoesStatus> {
  const [batismo, grupos, next, voluntariado] = await Promise.all([
    statusBatismo(membroId),
    statusGrupos(membroId),
    statusNext(),
    statusVoluntariado(),
  ]);
  return { batismo, grupos, next, voluntariado };
}

async function statusBatismo(membroId: string | null): Promise<StatusInscricao> {
  if (!membroId) return "nenhum";
  try {
    const b = await meuBatismo(membroId);
    if (!b) return "nenhum";
    return b.status === "realizado" ? "ativo" : "pendente";
  } catch {
    return "nenhum";
  }
}

async function statusGrupos(membroId: string | null): Promise<StatusInscricao> {
  if (!membroId) return "nenhum";
  try {
    // membro ativo num grupo?
    const { data: ativo } = await supabase
      .from("mem_grupo_membros")
      .select("id")
      .eq("membro_id", membroId)
      .is("saiu_em", null)
      .is("deleted_at", null)
      .limit(1);
    if (ativo && ativo.length) return "ativo";
    // pedido pendente?
    const { data: pend } = await supabase
      .from("mem_grupo_pedidos")
      .select("id")
      .eq("membro_id", membroId)
      .eq("status", "pendente")
      .is("deleted_at", null)
      .limit(1);
    return pend && pend.length ? "pendente" : "nenhum";
  } catch {
    return "nenhum";
  }
}

async function statusNext(): Promise<StatusInscricao> {
  try {
    const me = await getNextMe();
    return me.inscrito_next ? "ativo" : "nenhum";
  } catch {
    return "nenhum";
  }
}

async function statusVoluntariado(): Promise<StatusInscricao> {
  try {
    const me = await getVoluntariadoMe();
    if (!me.inscricao) return "nenhum";
    return me.inscricao.status === "integrado" ? "ativo" : "pendente";
  } catch {
    return "nenhum";
  }
}
