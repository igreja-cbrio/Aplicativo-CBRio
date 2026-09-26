import { apiGet, apiPost } from "./api";
import { supabase } from "./supabase";

export type MeuBatismo = {
  id: string;
  status: "pendente" | "realizado" | "cancelado" | string;
  data_batismo: string | null;   // ISO date (YYYY-MM-DD)
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
export async function meuBatismo(_membroId: string, eventoId?: string | null): Promise<MeuBatismo | null> {
  return apiGet<MeuBatismo | null>(`/app/campus/batismo/me${eventoId ? `?evento_id=${encodeURIComponent(eventoId)}` : ""}`);
}

/** Check-in da inscrição própria, confirmado e serializado no servidor. */
export async function fazerCheckin(inscricaoId:string): Promise<
 {ok:true;ja_checkado?:boolean;checkin_em:string}|{ok:false;erro:string}
> {
 try {return await apiPost(`/app/campus/batismo/${encodeURIComponent(inscricaoId)}/checkin`,{});}
 catch(e){return {ok:false,erro:e instanceof Error?e.message:"Não foi possível registrar o check-in."};}
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

export type FotoBatismo = {
  origem?: "campus" | "legado";
  nome: string;
  url: string;
};

/** URLs assinadas após confirmar a propriedade da inscrição, nunca por data isolada. */
export async function listarFotosBatismo(inscricaoId: string): Promise<FotoBatismo[]> {
  return apiGet<FotoBatismo[]>(`/app/campus/batismo/${encodeURIComponent(inscricaoId)}/fotos`);
}
