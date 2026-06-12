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
 * Contribuições CONCLUÍDAS do membro logado em um ano (mem_contribuicoes).
 * A RLS do sistema já limita a leitura às linhas do próprio membro
 * (membro_id = current_user_membro_id()), então a query é direta.
 * Só doações efetivadas entram aqui (cartão/Apple Pay via webhook do
 * Stripe; PIX/dinheiro via lançamentos e importações do financeiro).
 */
export async function minhasContribuicoes(ano: number): Promise<Contribuicao[]> {
  const { data, error } = await supabase
    .from("mem_contribuicoes")
    .select("id, tipo, valor, data, campanha, forma_pagamento")
    .gte("data", `${ano}-01-01`)
    .lte("data", `${ano}-12-31`)
    .order("data", { ascending: true });
  if (error) throw error;
  return (data as Contribuicao[]) ?? [];
}
