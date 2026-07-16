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
    // Conta como "em um grupo" quem participa (mem_grupo_membros) OU quem LIDERA
    // um grupo de conexão (líder também está conectado).
    const [membro, lider] = await Promise.all([
      supabase
        .from("mem_grupo_membros")
        .select("id")
        .eq("membro_id", membroId)
        .is("saiu_em", null)
        .is("deleted_at", null)
        .limit(1),
      supabase
        .from("mem_grupos")
        .select("id")
        .eq("lider_id", membroId)
        .is("deleted_at", null)
        .limit(1),
    ]);
    return !!(membro.data && membro.data.length) || !!(lider.data && lider.data.length);
  } catch {
    return false;
  }
}

async function foiBatizado(membroId: string): Promise<boolean> {
  try {
    // Batizado em outra igreja (auto-declarado) também vale — não precisa
    // aparecer como próximo passo pra quem já foi batizado.
    const [ant, b] = await Promise.all([
      supabase.from("mem_membros").select("batizado_outra_igreja").eq("id", membroId).maybeSingle(),
      meuBatismo(membroId),
    ]);
    if ((ant.data as { batizado_outra_igreja?: boolean } | null)?.batizado_outra_igreja) return true;
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
