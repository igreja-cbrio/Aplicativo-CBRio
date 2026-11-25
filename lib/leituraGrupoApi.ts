/**
 * Leitura em grupo · chamadas ao banco (RPCs do ERP, migration
 * `20261125160000_devocional_leitura_grupo.sql`). As tabelas não têm grant para
 * o app: tudo passa por estas funções, que conferem quem participa. A régua
 * pura (divisão, datas, código) está em `lib/leituraGrupo.ts`.
 */
import { supabase } from "@/lib/supabase";
import { LIVROS_BIBLIA, carregarCapitulo, type VersiculoLivre } from "@/lib/bibliaLivre";
import type { DiaLeitura, LivroEscolhido, Trecho } from "@/lib/leituraGrupo";

export type LeituraResumo = {
  id: string; titulo: string; livro_ordem: number; cap_inicio: number; cap_fim: number;
  data_inicio: string; dias: number; papel: "criador" | "participante"; participantes: number; meus_lidos: number;
  livros?: LivroEscolhido[] | null; fim_de_semana?: boolean;
};
export type Participante = { membro_id: string; nome: string; foto_url: string | null; papel: "criador" | "participante"; lidos: number[] };
export type LeituraDetalhe = {
  id: string; titulo: string; livro_ordem: number; cap_inicio: number; cap_fim: number;
  data_inicio: string; dias: number; divisao: DiaLeitura[]; codigo: string; hoje: string;
  eu: string; sou_criador: boolean; participantes: Participante[];
  livros?: LivroEscolhido[] | null; fim_de_semana?: boolean;
};
export type ConviteLeitura = {
  id: string; titulo: string; livro_ordem: number; cap_inicio: number; cap_fim: number;
  data_inicio: string; dias: number; criador_nome: string; participantes: number; ja_participa: boolean;
  livros?: LivroEscolhido[] | null; fim_de_semana?: boolean;
};

export function nomeDoLivro(ordem: number): string {
  return LIVROS_BIBLIA[ordem - 1]?.nome ?? "";
}

export async function criarLeitura(params: {
  titulo: string; livros: LivroEscolhido[]; dataInicio: string; fimDeSemana: boolean; divisao: DiaLeitura[];
}): Promise<{ id: string; codigo: string }> {
  const { data, error } = await supabase.rpc("devocional_leitura_criar_v2", {
    p_titulo: params.titulo, p_livros: params.livros, p_data_inicio: params.dataInicio,
    p_fim_de_semana: params.fimDeSemana, p_divisao: params.divisao,
  });
  if (error) throw error;
  const linha = Array.isArray(data) ? data[0] : data;
  if (!linha?.id) throw new Error("Não foi possível criar a leitura.");
  return linha as { id: string; codigo: string };
}

export async function minhasLeituras(): Promise<LeituraResumo[]> {
  const { data, error } = await supabase.rpc("devocional_leitura_minhas");
  if (error) throw error;
  return (data ?? []) as LeituraResumo[];
}

export async function detalheLeitura(id: string): Promise<LeituraDetalhe> {
  const { data, error } = await supabase.rpc("devocional_leitura_detalhe", { p_leitura: id });
  if (error) throw error;
  return data as LeituraDetalhe;
}

export async function conviteLeitura(codigo: string): Promise<ConviteLeitura | null> {
  const { data, error } = await supabase.rpc("devocional_leitura_convite", { p_codigo: codigo });
  if (error) throw error;
  return ((Array.isArray(data) ? data[0] : data) ?? null) as ConviteLeitura | null;
}

export async function entrarNaLeitura(codigo: string): Promise<string> {
  const { data, error } = await supabase.rpc("devocional_leitura_entrar", { p_codigo: codigo });
  if (error) throw error;
  return data as string;
}

export async function marcarDia(id: string, dia: number, lido: boolean): Promise<void> {
  const { error } = await supabase.rpc("devocional_leitura_marcar", { p_leitura: id, p_dia: dia, p_lido: lido });
  if (error) throw error;
}

export async function sairDaLeitura(id: string): Promise<void> {
  const { error } = await supabase.rpc("devocional_leitura_sair", { p_leitura: id });
  if (error) throw error;
}

/** Texto do dia: busca cada capítulo na versão escolhida e recorta os versículos do trecho. */
export async function textoDoDia(livroPadrao: number, dia: DiaLeitura, versao?: string): Promise<{ trecho: Trecho; versiculos: VersiculoLivre[] }[]> {
  return Promise.all(dia.trechos.map(async (trecho) => {
    const livro = LIVROS_BIBLIA[(trecho.livro ?? livroPadrao) - 1];
    if (!livro) throw new Error("Livro inválido.");
    const todos = await carregarCapitulo(livro, trecho.cap, versao);
    const de = trecho.de ?? 1, ate = trecho.ate ?? Number.MAX_SAFE_INTEGER;
    return { trecho, versiculos: todos.filter(v => v.verse >= de && v.verse <= ate) };
  }));
}
