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
export async function meuBatismo(membroId: string): Promise<MeuBatismo | null> {
  const { data } = await supabase
    .from("batismo_inscricoes")
    .select("id, status, data_batismo, nome, sobrenome, tamanho_camisa, eh_crianca, observacoes, checkin_em")
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
  /**
   * ⚠️⚠️ "Já me batizei AQUI na CBRio" (27/08/2026 · pedido do Marcos): batismo
   * REAL anterior ao sistema, sem linha em `batismo_inscricoes`.
   *
   * Antes disso a pessoa nessa situação não tinha o que marcar — e escrever
   * "CBRio" no campo de OUTRA igreja gravaria a própria igreja como se fosse
   * outra. É declaração: **não entra em KPI de batismo nenhum**; o que ela faz
   * é parar de cobrar batismo de quem já se batizou.
   */
  batismo_cbrio_declarado: boolean;
  batismo_cbrio_data: string | null;
};

export async function getBatismoAnterior(membroId: string): Promise<BatismoAnterior> {
  // ⚠️⚠️ As colunas do batismo na CBRio saem em SELECT SEPARADO, e não juntas
  // com as de "outra igreja": pedir coluna que ainda não existe faz o PostgREST
  // recusar a QUERY INTEIRA (42703), e aí o app perderia também a declaração de
  // outra igreja, que JÁ está em produção. Deploy em 2 etapas (o OTA chega antes
  // ou depois da migration) não pode quebrar o que já funciona.
  // ⚠️ O builder do PostgREST é PromiseLike e NÃO tem `.catch` — o try/catch
  // precisa envolver o `await`, senão nem compila.
  const lerCbrio = async (): Promise<{ data: unknown }> => {
    try {
      return await supabase
        .from("mem_membros")
        .select("batismo_cbrio_declarado_em, batismo_cbrio_data")
        .eq("id", membroId)
        .is("deleted_at", null)
        .maybeSingle();
    } catch {
      return { data: null };
    }
  };
  const [base, cbrio] = await Promise.all([
    supabase
      .from("mem_membros")
      .select("batizado_outra_igreja, igreja_batismo_anterior")
      .eq("id", membroId)
      .is("deleted_at", null)
      .maybeSingle(),
    lerCbrio(),
  ]);
  const data = base.data;
  const c = cbrio.data as { batismo_cbrio_declarado_em?: string | null; batismo_cbrio_data?: string | null } | null;
  return {
    batizado_outra_igreja: !!(data as { batizado_outra_igreja?: boolean } | null)?.batizado_outra_igreja,
    igreja_batismo_anterior: (data as { igreja_batismo_anterior?: string | null } | null)?.igreja_batismo_anterior ?? null,
    batismo_cbrio_declarado: !!c?.batismo_cbrio_declarado_em,
    batismo_cbrio_data: c?.batismo_cbrio_data ?? null,
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

/**
 * Declara que já se batizou NA CBRio. `data` é opcional — quem não lembra o dia
 * não pode ficar impedido de registrar o fato.
 * ⚠️ A RPC resolve a pessoa por `auth.uid()`; não existe parâmetro de pessoa.
 */
export async function marcarBatismoCbrio(data?: string | null): Promise<void> {
  const { error } = await supabase.rpc("app_marcar_batizado_cbrio", { p_data: data ?? null });
  if (error) throw error;
}

export async function desmarcarBatismoCbrio(): Promise<void> {
  const { error } = await supabase.rpc("app_desmarcar_batizado_cbrio");
  if (error) throw error;
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
