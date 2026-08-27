import { supabase } from "./supabase";
import { streakDevocional } from "./devocional";
import { minhasContribuicoes } from "./contribuicoes";
import { meuBatismo } from "./batismo";
import { getVoluntariadoMe } from "./api";
import { decidirServe } from "./serveJornada";

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
      .eq("concluida", true)
      // `mem_devocionais` é soft-deletable: linha apagada sai do KPI do ERP,
      // então também não pode contar na jornada do app.
      .is("deleted_at", null);
    return count ?? 0;
  } catch {
    return 0;
  }
}

/**
 * "Esta pessoa serve?" — pela régua do SISTEMA, não pelo formulário.
 *
 * ⚠️⚠️ ISTO ERA UM FALSO NEGATIVO EM MASSA (corrigido em 27/08, relato do
 * Marcos sobre uma líder que serve há meses e via "Comece a servir"): a função
 * perguntava `!!me.inscricao`, ou seja **se a pessoa preencheu o formulário
 * público de voluntariado** — e formulário não é serviço. Quem entrou pelo
 * Planning Center ou foi integrada pela liderança nunca preencheu.
 *
 * **Medido: das 598 pessoas com vínculo ativo de voluntário, 314 (52%) não têm
 * inscrição nenhuma.** Todas viam a própria jornada dizendo que não servem.
 * Mesma classe do bug de 13/08 (ler o telefone só de `vol_profiles` e concluir
 * "não tem"): confundir "não procurei no lugar certo" com "a pessoa não faz".
 *
 * A ordem de leitura é do mais forte pro mais fraco, e o fallback existe porque
 * o servidor pode ser mais antigo que este bundle (deploy em 2 etapas):
 *  1. `serve` — vínculo vivo em `mem_voluntarios` (a régua da NSM e do painel);
 *  2. `voluntario_ativo` — perfil do PCO alcançável por esta conta;
 *  3. `inscricao` — o formulário, que é o que existia antes.
 */
async function serveVol(): Promise<boolean> {
  try {
    return decidirServe(await getVoluntariadoMe());
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
      supabase.from("mem_membros").select("batizado_outra_igreja").eq("id", membroId).is("deleted_at", null).maybeSingle(),
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
