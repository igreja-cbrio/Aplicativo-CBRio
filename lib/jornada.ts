import { supabase } from "./supabase";
import { streakDevocional } from "./devocional";
import { minhasContribuicoes } from "./contribuicoes";
import { meuBatismo } from "./batismo";
import { getVoluntariadoMe } from "./api";

export type Jornada = {
  devocionalStreak: number;
  devocionalTotal: number;
  serveVoluntariado: boolean;
  emGrupo: boolean;
  batizado: boolean;
  generosidadeAno: number; // total em R$ no ano corrente
};

/**
 * Métricas da jornada do membro pra tela "Sua jornada". Cada fonte é
 * independente e tolerante a falha (cai em zero/false), pra um painel
 * nunca quebrar por causa de uma consulta.
 */
export async function carregarJornada(membroId: string): Promise<Jornada> {
  const [devocionalStreak, devocionalTotal, serveVoluntariado, emGrupo, batizado, generosidadeAno] =
    await Promise.all([
      streakDevocional(membroId).catch(() => 0),
      totalDevocionais(membroId),
      serveVol(),
      estaEmGrupo(membroId),
      foiBatizado(membroId),
      totalGenerosidadeAno(membroId),
    ]);
  return { devocionalStreak, devocionalTotal, serveVoluntariado, emGrupo, batizado, generosidadeAno };
}

async function totalDevocionais(membroId: string): Promise<number> {
  try {
    const { count } = await supabase
      .from("mem_devocionais")
      .select("id", { count: "exact", head: true })
      .eq("membro_id", membroId)
      .eq("tipo", "pessoal")
      .eq("concluida", true);
    return count ?? 0;
  } catch {
    return 0;
  }
}

async function serveVol(): Promise<boolean> {
  try {
    const me = await getVoluntariadoMe();
    return !!me.inscricao;
  } catch {
    return false;
  }
}

async function estaEmGrupo(membroId: string): Promise<boolean> {
  try {
    const { data } = await supabase
      .from("mem_grupo_membros")
      .select("id")
      .eq("membro_id", membroId)
      .is("saiu_em", null)
      .is("deleted_at", null)
      .limit(1);
    return !!(data && data.length);
  } catch {
    return false;
  }
}

async function foiBatizado(membroId: string): Promise<boolean> {
  try {
    const b = await meuBatismo(membroId);
    return b?.status === "realizado";
  } catch {
    return false;
  }
}

async function totalGenerosidadeAno(membroId: string): Promise<number> {
  try {
    const ano = new Date().getFullYear();
    const itens = await minhasContribuicoes(membroId, ano);
    return itens.reduce((s, c) => s + Number(c.valor), 0);
  } catch {
    return 0;
  }
}
