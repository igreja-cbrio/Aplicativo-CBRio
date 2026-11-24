import { supabase } from "./supabase";

export type MeuBatismo = {
  id: string;
  status: "pendente" | "realizado" | "cancelado" | string;
  data_batismo: string | null;   // ISO date (YYYY-MM-DD)
  horario_culto?: string | null;
  nome: string | null;
  sobrenome: string | null;
  tamanho_camisa: string | null;
  eh_crianca: boolean | null;
  observacoes: string | null;
  checkin_em: string | null;     // ISO timestamp
};

/**
 * Retorna a inscrição de batismo "relevante" do membro:
 *  - prioriza status 'pendente' (futura).
 *  - aceita 'realizado' SÓ se tem data (histórico válido p/ mostrar fotos).
 *  - ignora rows antigas de totem com status='realizado' e data nula.
 *  - ignora 'cancelado'.
 */
export async function meuBatismo(membroId: string): Promise<MeuBatismo | null> {
  const { data } = await supabase
    .from("batismo_inscricoes")
    .select("id, status, data_batismo, horario_culto, nome, sobrenome, tamanho_camisa, eh_crianca, observacoes, checkin_em")
    .eq("membro_id", membroId)
    .is("deleted_at", null)
    .neq("status", "cancelado")
    .order("created_at", { ascending: false });
  const lista = (data as MeuBatismo[]) ?? [];

  // Prioridade: pendente -> realizado com data -> nada
  const pendente = lista.find((b) => b.status === "pendente");
  if (pendente) return pendente;
  const realizadoComData = lista.find((b) => b.status === "realizado" && b.data_batismo);
  if (realizadoComData) return realizadoComData;
  return null;
}

/** Faz o check-in via RPC (server-side valida data + status + propriedade). */
export async function fazerCheckin(inscricaoId: string): Promise<
  { ok: true; ja_checkado?: boolean; checkin_em: string }
  | { ok: false; erro: string }
> {
  const { data, error } = await supabase.rpc("app_batismo_checkin", {
    p_inscricao: inscricaoId,
  });
  if (error) return { ok: false, erro: error.message };
  return data as { ok: true; ja_checkado?: boolean; checkin_em: string } | { ok: false; erro: string };
}

export type BatismoAnterior = {
  batizado_outra_igreja: boolean;
  igreja_batismo_anterior: string | null;
};

export async function getBatismoAnterior(membroId: string): Promise<BatismoAnterior> {
  const { data } = await supabase
    .from("mem_membros")
    .select("batizado_outra_igreja, igreja_batismo_anterior")
    .eq("id", membroId)
    .is("deleted_at", null)
    .maybeSingle();
  return {
    batizado_outra_igreja: !!(data as { batizado_outra_igreja?: boolean } | null)?.batizado_outra_igreja,
    igreja_batismo_anterior: (data as { igreja_batismo_anterior?: string | null } | null)?.igreja_batismo_anterior ?? null,
  };
}

export async function marcarBatismoAnterior(igreja: string): Promise<void> {
  const { error } = await supabase.rpc("app_marcar_batizado_outra", { p_igreja: igreja });
  if (error) throw error;
}

export async function desmarcarBatismoAnterior(): Promise<void> {
  const { error } = await supabase.rpc("app_desmarcar_batizado_outra");
  if (error) throw error;
}

// ⚠️ A galeria antiga (`listarFotosBatismo`, bucket público `batismos/AAAA-MM-DD`)
// saiu em 24/11/2026: as fotos agora são o álbum privado de `lib/batismoFotos.ts`.
