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

/** Retorna a inscrição de batismo ativa mais recente do membro logado. */
export async function meuBatismo(membroId: string): Promise<MeuBatismo | null> {
  const { data } = await supabase
    .from("batismo_inscricoes")
    .select("id, status, data_batismo, nome, sobrenome, tamanho_camisa, eh_crianca, observacoes, checkin_em")
    .eq("membro_id", membroId)
    .is("deleted_at", null)
    .neq("status", "cancelado")
    .order("created_at", { ascending: false })
    .limit(1);
  const lista = (data as MeuBatismo[]) ?? [];
  return lista[0] ?? null;
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

export type FotoBatismo = {
  nome: string;
  url: string;
};

/**
 * Lista as fotos do dia do batismo (path no storage: batismos/YYYY-MM-DD/...).
 * Marketing sobe via dashboard. URLs públicas (bucket é público pra leitura).
 */
export async function listarFotosBatismo(dataIso: string): Promise<FotoBatismo[]> {
  const folder = dataIso;
  const { data } = await supabase.storage
    .from("batismos")
    .list(folder, { limit: 200, sortBy: { column: "name", order: "asc" } });
  return (data ?? [])
    .filter((f) => f.name && !f.name.endsWith("/"))
    .map((f) => ({
      nome: f.name,
      url: supabase.storage.from("batismos").getPublicUrl(`${folder}/${f.name}`).data.publicUrl,
    }));
}
