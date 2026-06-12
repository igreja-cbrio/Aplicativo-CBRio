import { supabase } from "./supabase";

export type Contribuicao = {
  id: string;
  tipo: "dizimo" | "oferta" | "campanha";
  valor: number;
  data: string; // YYYY-MM-DD
  campanha: string | null;
  forma_pagamento: string | null;
};

/**
 * Contribuições CONCLUÍDAS de um membro em um ano (mem_contribuicoes).
 * ⚠️ O filtro por membro_id é EXPLÍCITO: a RLS sozinha não basta porque
 * contas admin/diretor têm bypass de leitura (financeiro >= 3) e veriam
 * as contribuições de TODOS no próprio comprovante.
 * Só doações efetivadas entram aqui (cartão/Apple Pay via webhook do
 * Stripe; PIX/dinheiro via lançamentos e importações do financeiro).
 */
export async function minhasContribuicoes(membroId: string, ano: number): Promise<Contribuicao[]> {
  const { data, error } = await supabase
    .from("mem_contribuicoes")
    .select("id, tipo, valor, data, campanha, forma_pagamento")
    .eq("membro_id", membroId)
    .gte("data", `${ano}-01-01`)
    .lte("data", `${ano}-12-31`)
    .order("data", { ascending: true });
  if (error) throw error;
  return (data as Contribuicao[]) ?? [];
}
