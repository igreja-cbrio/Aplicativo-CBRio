import { supabase } from "./supabase";
import { meuBatismo } from "./batismo";
import { getVoluntariadoMe, getNextMe } from "./api";
import { estadoVoluntariado } from "./volStatus";

// ⚠️⚠️ `"desconhecido"` existe porque os 4 catches abaixo devolviam `"nenhum"`
// (07/08/2026 · Onda 4). Erro de rede, timeout ou 429 viravam a AFIRMAÇÃO
// "você não está inscrito em nada" no hub de Inscrições — e a pessoa acredita:
// pode se reinscrever, ou achar que perdeu a vaga.
// "Não consegui perguntar" NÃO é "a resposta é não". Ver `lib/falhaDeLeitura.ts`.
export type StatusInscricao = "nenhum" | "pendente" | "ativo" | "desconhecido";

export type InscricoesStatus = {
  batismo: StatusInscricao;
  grupos: StatusInscricao;
  next: StatusInscricao;
  voluntariado: StatusInscricao;
};

/**
 * Estado consolidado das inscrições do membro pra mostrar "já inscrito /
 * pendente" na tela de Inscrições. Cada fonte é independente e, quando falha,
 * devolve `"desconhecido"` — NUNCA `"nenhum"`, que seria afirmar o contrário
 * do que não conseguimos ler.
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
    return "desconhecido";
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
    return "desconhecido";
  }
}

async function statusNext(): Promise<StatusInscricao> {
  try {
    const me = await getNextMe();
    return me.inscrito_next ? "ativo" : "nenhum";
  } catch {
    return "desconhecido";
  }
}

async function statusVoluntariado(): Promise<StatusInscricao> {
  try {
    const me = await getVoluntariadoMe();
    if (!me.inscricao) return me.voluntario_ativo === true ? "ativo" : "nenhum";
    // ⚠️ Régua ÚNICA (lib/volStatus.ts) — a MESMA que a tela de Servir usa. Antes
    // aqui era `=== "integrado" ? ativo : pendente`, então quem a equipe encerrou
    // (`nao_responde`, 69 pessoas) via "Pendente" no hub e o FORMULÁRIO na tela:
    // duas verdades sobre o mesmo dado.
    return estadoVoluntariado(me.inscricao.status, me.voluntario_ativo);
  } catch {
    return "desconhecido";
  }
}
