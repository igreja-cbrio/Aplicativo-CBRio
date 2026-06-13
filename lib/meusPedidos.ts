import { supabase } from "./supabase";

export type PedidoCuidado = {
  id: string;
  tipo: "oracao" | "aconselhamento" | "sos";
  mensagem: string | null;
  tratamento_status: "pendente" | "em_andamento" | "concluido";
  created_at: string;
};

/**
 * Pedidos de cuidado (oração/aconselhamento/SOS) que o próprio membro
 * enviou, com o status do tratamento pastoral. A RLS de app_inscricoes
 * (auth.uid() = auth_user_id) já limita ao dono — leitura direta.
 */
export async function meusPedidosCuidado(): Promise<PedidoCuidado[]> {
  const { data, error } = await supabase
    .from("app_inscricoes")
    .select("id, tipo, dados, tratamento_status, created_at")
    .in("tipo", ["oracao", "aconselhamento", "sos"])
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) throw error;
  return ((data as { id: string; tipo: string; dados: Record<string, unknown> | null; tratamento_status: string | null; created_at: string }[]) ?? []).map((r) => ({
    id: r.id,
    tipo: r.tipo as PedidoCuidado["tipo"],
    mensagem: (r.dados?.mensagem as string) ?? null,
    tratamento_status: (r.tratamento_status as PedidoCuidado["tratamento_status"]) ?? "pendente",
    created_at: r.created_at,
  }));
}
