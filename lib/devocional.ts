import { supabase } from "./supabase";

export type DevocionalItem = {
  id: string;
  plano_id: string;
  data: string; // YYYY-MM-DD
  titulo: string;
  passagem: string | null;
  passagem_texto: string | null;
  reflexao: string;
  aplicacao: string | null;
  oracao: string | null;
};

export type CheckinDevocional = {
  data_devocional: string;
  devocional_item_id: string | null;
};

/** Data local (aparelho) em YYYY-MM-DD. */
export function hojeISO(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Segunda-feira da semana da data (semana devocional = seg–sex). */
export function segundaDaSemana(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  const dow = d.getDay(); // 0=dom
  const delta = dow === 0 ? -6 : 1 - dow;
  d.setDate(d.getDate() + delta);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function somaDias(iso: string, dias: number): string {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + dias);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * Itens da semana devocional atual (seg–sex) dos planos ATIVOS, mais os
 * check-ins do membro na mesma janela. Leitura direta do Supabase — as
 * policies já liberam SELECT pra qualquer autenticado.
 */
export async function semanaDevocional(membroId: string | null): Promise<{
  itens: DevocionalItem[];
  checkins: CheckinDevocional[];
}> {
  const seg = segundaDaSemana(hojeISO());
  const sex = somaDias(seg, 4);

  const { data: itens, error } = await supabase
    .from("devocional_itens")
    .select(
      "id, plano_id, data, titulo, passagem, passagem_texto, reflexao, aplicacao, oracao, devocional_planos!inner(ativo)"
    )
    .eq("devocional_planos.ativo", true)
    .gte("data", seg)
    .lte("data", sex)
    .order("data", { ascending: true });
  if (error) throw error;

  let checkins: CheckinDevocional[] = [];
  if (membroId) {
    const { data: cks } = await supabase
      .from("mem_devocionais")
      .select("data_devocional, devocional_item_id")
      .eq("membro_id", membroId)
      .eq("tipo", "pessoal")
      .gte("data_devocional", seg)
      .lte("data_devocional", sex);
    checkins = (cks as CheckinDevocional[]) ?? [];
  }

  return {
    itens: ((itens as unknown as DevocionalItem[]) ?? []).map((i) => ({
      ...i,
    })),
    checkins,
  };
}

/**
 * Marca o devocional do dia como concluído (alimenta os indicadores do
 * sistema — mem_devocionais é a fonte dos KPIs de devocional).
 * Idempotente: UNIQUE (membro_id, data_devocional, tipo).
 */
export async function checkInDevocional(
  membroId: string,
  itemId: string,
  observacoes?: string
): Promise<void> {
  const { error } = await supabase.from("mem_devocionais").upsert(
    {
      membro_id: membroId,
      data_devocional: hojeISO(),
      tipo: "pessoal",
      devocional_item_id: itemId,
      concluida: true,
      observacoes: observacoes?.trim() || null,
    },
    { onConflict: "membro_id,data_devocional,tipo" }
  );
  if (error) throw error;
}

/**
 * Sequência (streak) de DIAS ÚTEIS consecutivos com check-in, contando
 * pra trás a partir de hoje (ou de ontem, se hoje ainda não leu).
 * Sábado e domingo não quebram a sequência.
 */
export async function streakDevocional(membroId: string): Promise<number> {
  const { data } = await supabase
    .from("mem_devocionais")
    .select("data_devocional")
    .eq("membro_id", membroId)
    .eq("tipo", "pessoal")
    .eq("concluida", true)
    .order("data_devocional", { ascending: false })
    .limit(120);
  const dias = new Set(((data as { data_devocional: string }[]) ?? []).map((d) => d.data_devocional));
  if (dias.size === 0) return 0;

  let cursor = hojeISO();
  const ehUtil = (iso: string) => {
    const dow = new Date(`${iso}T12:00:00`).getDay();
    return dow >= 1 && dow <= 5;
  };
  // Hoje ainda sem check-in não zera: começa a contar de ontem.
  if (!dias.has(cursor)) cursor = somaDias(cursor, -1);

  let streak = 0;
  for (let i = 0; i < 120; i++) {
    if (ehUtil(cursor)) {
      if (dias.has(cursor)) streak += 1;
      else break;
    }
    cursor = somaDias(cursor, -1);
  }
  return streak;
}
