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

export type PlanoDevocional = {
  id: string; titulo: string; descricao: string | null; data_inicio: string; data_fim: string;
  ativo: boolean; slug: string | null; continuo: boolean; inscricao_habilitada: boolean;
  destaque: boolean; inscrito?: boolean;
};

export type ItemEdicao = DevocionalItem & {
  edicao_slug: string | null; edicao_titulo: string | null; edicao_inicio: string | null;
  edicao_fim: string | null; ordem_no_ciclo: number | null; autor: string | null;
};

export type PostMural = {
  id: string; item_id: string | null; referencia_biblica: string | null; texto: string;
  created_at: string; item_titulo: string | null; item_passagem: string | null;
  autor_nome: string; alcance: "igreja" | "grupo" | "servir"; texto_biblico: string | null;
};

export async function listarPlanos(membroId: string | null): Promise<PlanoDevocional[]> {
  const { data, error } = await supabase.from("devocional_planos")
    .select("id,titulo,descricao,data_inicio,data_fim,ativo,slug,continuo,inscricao_habilitada,destaque")
    .eq("ativo", true).order("destaque", { ascending: false }).order("created_at", { ascending: false });
  if (error) throw error;
  let inscritos = new Set<string>();
  if (membroId) {
    const { data: rows, error: erroInscricao } = await supabase.from("devocional_inscricoes")
      .select("plano_id").eq("membro_id", membroId);
    if (erroInscricao) throw erroInscricao;
    inscritos = new Set((rows ?? []).map((r) => r.plano_id));
  }
  return ((data ?? []) as PlanoDevocional[]).map((p) => ({ ...p, inscrito: inscritos.has(p.id) }));
}

export async function inscreverNoPlano(planoId: string, membroId: string): Promise<void> {
  const { error } = await supabase.from("devocional_inscricoes")
    .upsert({ plano_id: planoId, membro_id: membroId }, { onConflict: "plano_id,membro_id", ignoreDuplicates: true });
  if (error) throw error;
}

export async function itensDoPlano(planoId: string): Promise<ItemEdicao[]> {
  const { data, error } = await supabase.from("devocional_itens")
    .select("id,plano_id,data,titulo,passagem,passagem_texto,reflexao,aplicacao,oracao,edicao_slug,edicao_titulo,edicao_inicio,edicao_fim,ordem_no_ciclo,autor")
    .eq("plano_id", planoId).order("data", { ascending: false }).limit(180);
  if (error) throw error;
  return (data ?? []) as ItemEdicao[];
}

/**
 * Planos oferecidos no carrossel "Planos sugeridos" da home do Devocional
 * (24/09/2026): ativos E com inscrição habilitada, com a contagem de dias.
 * ⚠️ Plano CONTÍNUO (Quarta com Deus, semana) não tem "N dias" — a contagem
 * só é buscada pros de inscrição, que são pequenos (o Valores de Cristo tem 5).
 */
export type PlanoSugerido = PlanoDevocional & { total_dias: number | null };
export async function planosSugeridos(membroId: string | null): Promise<PlanoSugerido[]> {
  const planos = (await listarPlanos(membroId)).filter((p) => p.inscricao_habilitada);
  const porInscricao = planos.filter((p) => !p.continuo).map((p) => p.id);
  const contagem = new Map<string, number>();
  if (porInscricao.length) {
    const { data, error } = await supabase.from("devocional_itens").select("plano_id").in("plano_id", porInscricao);
    if (error) throw error;
    for (const r of data ?? []) contagem.set(r.plano_id, (contagem.get(r.plano_id) ?? 0) + 1);
  }
  return planos.map((p) => ({ ...p, total_dias: p.continuo ? null : contagem.get(p.id) ?? 0 }));
}

/** Um plano pelo id, com `inscrito` do membro. `null` se não existe ou está inativo. */
export async function planoPorId(planoId: string, membroId: string | null): Promise<PlanoDevocional | null> {
  return (await listarPlanos(membroId)).find((p) => p.id === planoId) ?? null;
}

/** Ids dos itens DESTE plano que o membro já leu (devocional_leituras_planos). */
export async function leiturasDoPlano(membroId: string, planoId: string): Promise<string[]> {
  const { data, error } = await supabase.from("devocional_leituras_planos")
    .select("item_id, devocional_itens!inner(plano_id)")
    .eq("membro_id", membroId).eq("devocional_itens.plano_id", planoId);
  if (error) throw error;
  return (data ?? []).map((r: any) => r.item_id as string);
}

/** Um item pelo id (conteúdo completo do dia). */
export async function itemDoPlano(itemId: string): Promise<ItemEdicao | null> {
  const { data, error } = await supabase.from("devocional_itens")
    .select("id,plano_id,data,titulo,passagem,passagem_texto,reflexao,aplicacao,oracao,edicao_slug,edicao_titulo,edicao_inicio,edicao_fim,ordem_no_ciclo,autor")
    .eq("id", itemId).maybeSingle();
  if (error) throw error;
  return (data as ItemEdicao | null) ?? null;
}

export async function listarMural(): Promise<PostMural[]> {
  const { data, error } = await supabase.rpc("listar_devocional_mural", { p_limite: 60 });
  if (error) throw error;
  return (data ?? []) as PostMural[];
}

export async function publicarNoMural(params: { membroId: string; texto: string; alcance: PostMural["alcance"]; itemId?: string; referenciaBiblica?: string; textoBiblico?: string }): Promise<void> {
  const { error } = await supabase.from("devocional_mural").insert({
    membro_id: params.membroId, texto: params.texto.trim(), item_id: params.itemId ?? null,
    referencia_biblica: params.referenciaBiblica?.trim() || null, texto_biblico: params.textoBiblico?.trim() || null,
    alcance: params.alcance, status: "publicado",
  });
  if (error) throw error;
}

export type RegistroDevocional = {
  id: string; fonte: "pessoal" | "comentario"; origem: "biblia" | "devocional";
  referencia_biblica: string; texto_biblico: string | null; comentario: string | null;
  cor: string | null; destino: "privado" | PostMural["alcance"]; created_at: string;
};
export async function salvarRegistroPessoal(params: {
  membroId: string; origem: RegistroDevocional["origem"]; referencia: string; textoBiblico?: string;
  comentario?: string; cor?: "amarelo" | "azul" | "verde" | "rosa"; itemId?: string;
}): Promise<void> {
  const { error } = await supabase.from("devocional_registros_pessoais").insert({
    membro_id: params.membroId, origem: params.origem, referencia_biblica: params.referencia,
    texto_biblico: params.textoBiblico?.trim() || null, comentario: params.comentario?.trim() || null,
    cor: params.cor ?? null, item_id: params.itemId ?? null,
  });
  if (error) throw error;
}
export async function listarMarcacoesBiblia(membroId: string, referenciaCapitulo: string): Promise<{ referencia_biblica: string; cor: string }[]> {
  const { data, error } = await supabase.from("devocional_registros_pessoais")
    .select("referencia_biblica,cor,created_at")
    .eq("membro_id", membroId).eq("origem", "biblia").not("cor", "is", null)
    .like("referencia_biblica", referenciaCapitulo + ":%")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as { referencia_biblica: string; cor: string }[];
}
export async function removerMarcacoesBiblia(membroId: string, referenciaCapitulo: string, versiculos: number[]): Promise<number[]> {
  const { data, error } = await supabase.from("devocional_registros_pessoais")
    .select("id,referencia_biblica").eq("membro_id", membroId).eq("origem", "biblia")
    .not("cor", "is", null).like("referencia_biblica", referenciaCapitulo + ":%");
  if (error) throw error;
  const selecionados = new Set(versiculos);
  const atingidos = (data ?? []).filter((r: any) => r.referencia_biblica.slice(referenciaCapitulo.length + 1).split(",").some((v: string) => selecionados.has(Number(v))));
  if (!atingidos.length) return [];
  const { error: erroDelete } = await supabase.from("devocional_registros_pessoais").delete().in("id", atingidos.map((r: any) => r.id));
  if (erroDelete) throw erroDelete;
  return [...new Set(atingidos.flatMap((r: any) => r.referencia_biblica.slice(referenciaCapitulo.length + 1).split(",").map(Number)))];
}
export async function ultimaLeituraBiblia(membroId: string): Promise<string | null> {
  const { data, error } = await supabase.from("devocional_leituras_biblia")
    .select("referencia").eq("membro_id", membroId).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (error) throw error;
  return data?.referencia ?? null;
}
export async function listarMeusRegistros(membroId: string): Promise<RegistroDevocional[]> {
  const [pessoais, comentarios] = await Promise.all([
    supabase.from("devocional_registros_pessoais").select("id,origem,referencia_biblica,texto_biblico,comentario,cor,created_at").eq("membro_id", membroId),
    supabase.from("devocional_mural").select("id,item_id,referencia_biblica,texto_biblico,texto,alcance,created_at").eq("membro_id", membroId).eq("status", "publicado"),
  ]);
  if (pessoais.error) throw pessoais.error;
  if (comentarios.error) throw comentarios.error;
  const a = (pessoais.data ?? []).map((r: any): RegistroDevocional => ({ ...r, fonte: "pessoal", destino: "privado" }));
  const b = (comentarios.data ?? []).map((r: any): RegistroDevocional => ({
    id: r.id, fonte: "comentario", origem: r.item_id ? "devocional" : "biblia",
    referencia_biblica: r.referencia_biblica, texto_biblico: r.texto_biblico,
    comentario: r.texto, cor: null, destino: r.alcance, created_at: r.created_at,
  }));
  return [...a, ...b].sort((x, y) => y.created_at.localeCompare(x.created_at));
}
export async function excluirRegistro(registro: RegistroDevocional): Promise<void> {
  const tabela = registro.fonte === "pessoal" ? "devocional_registros_pessoais" : "devocional_mural";
  const { error } = await supabase.from(tabela).delete().eq("id", registro.id);
  if (error) throw error;
}
export async function registrarLeituraBiblia(membroId: string, referencia: string): Promise<void> {
  const { error } = await supabase.from("devocional_leituras_biblia").upsert(
    { membro_id: membroId, data_leitura: hojeISO(), referencia },
    { onConflict: "membro_id,data_leitura,referencia", ignoreDuplicates: true }
  );
  if (error) throw error;
}
export type ResumoPlano = { plano_titulo: string; edicao_titulo: string; total_itens: number; itens_lidos: number; concluido: boolean; ultima_leitura: string };
export async function resumoMinhasLeituras(membroId: string): Promise<{ leituras: { data_leitura: string; referencia: string }[]; planos: ResumoPlano[] }> {
  const [biblia, planos] = await Promise.all([
    supabase.from("devocional_leituras_biblia").select("data_leitura,referencia").eq("membro_id", membroId).order("data_leitura", { ascending: false }).limit(180),
    supabase.rpc("resumo_meus_planos_devocionais"),
  ]);
  if (biblia.error) throw biblia.error;
  if (planos.error) throw planos.error;
  return { leituras: biblia.data ?? [], planos: (planos.data ?? []) as ResumoPlano[] };
}

/** Data local (aparelho) em YYYY-MM-DD. */
export function hojeISO(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Segunda-feira da semana da data (semana devocional = seg–sex). */
export function segundaDaSemana(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  const dow = d.getDay();
  const delta = dow === 0 ? -6 : 1 - dow;
  d.setDate(d.getDate() + delta);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Quinta-feira que abre o ciclo vigente do Quarta com Deus (qui–qua). */
export function quintaDoCiclo(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  const dow = d.getDay();
  const delta = dow >= 4 ? 4 - dow : -(dow + 3);
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
export async function semanaDevocional(membroId: string | null, cicloQuarta = false): Promise<{
  itens: DevocionalItem[];
  checkins: CheckinDevocional[];
}> {
  const inicio = cicloQuarta ? quintaDoCiclo(hojeISO()) : segundaDaSemana(hojeISO());
  const fim = somaDias(inicio, cicloQuarta ? 6 : 4);

  const { data: itens, error } = await supabase
    .from("devocional_itens")
    .select(
      "id, plano_id, data, titulo, passagem, passagem_texto, reflexao, aplicacao, oracao, devocional_planos!inner(ativo)"
    )
    .eq("devocional_planos.ativo", true)
    .gte("data", inicio)
    .lte("data", fim)
    .order("data", { ascending: true });
  if (error) throw error;

  let checkins: CheckinDevocional[] = [];
  if (membroId) {
    const { data: cks } = await supabase
      .from("devocional_leituras_planos")
      .select("data_leitura, item_id")
      .eq("membro_id", membroId)
      .gte("data_leitura", inicio)
      .lte("data_leitura", fim);
    checkins = (cks ?? []).map((c: any) => ({ data_devocional: c.data_leitura, devocional_item_id: c.item_id }));
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
  const { error: erroLeitura } = await supabase.from("devocional_leituras_planos").upsert(
    { membro_id: membroId, item_id: itemId, data_leitura: hojeISO() },
    { onConflict: "membro_id,item_id", ignoreDuplicates: true }
  );
  if (erroLeitura) throw erroLeitura;
  // ⚠️⚠️ NUNCA `upsert` em mem_devocionais (24/09/2026 · o "não foi possível
  // registrar" do Marcos). O índice único `uq_mem_devocionais_dia` virou
  // PARCIAL em 09/09 (`WHERE deleted_at IS NULL`, pra o soft-delete liberar a
  // chave) — e `ON CONFLICT` do PostgREST NÃO infere índice parcial: todo
  // check-in caía em 42P10, do plano E do diário. A idempotência aqui é
  // select → update/insert; corrida de um mesmo membro em dois toques é
  // inofensiva (o 2º cai no update).
  const hoje = hojeISO();
  const { data: existente, error: erroBusca } = await supabase.from("mem_devocionais")
    .select("id").eq("membro_id", membroId).eq("data_devocional", hoje).eq("tipo", "pessoal")
    .is("deleted_at", null).limit(1).maybeSingle();
  if (erroBusca) throw erroBusca;
  const linha = { devocional_item_id: itemId, concluida: true, observacoes: observacoes?.trim() || null };
  const { error } = existente
    ? await supabase.from("mem_devocionais").update(linha).eq("id", existente.id)
    : await supabase.from("mem_devocionais").insert({ membro_id: membroId, data_devocional: hoje, tipo: "pessoal", ...linha });
  if (error) throw error;
}

// Régua pura em lib/erroMensagem.ts (entra no portão sem arrastar o supabase).
export { mensagemDoErro } from "./erroMensagem";

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
    .is("deleted_at", null)
    .order("data_devocional", { ascending: false })
    .limit(120);
  const dias = new Set(((data as { data_devocional: string }[]) ?? []).map((d) => d.data_devocional));
  if (dias.size === 0) return 0;

  let cursor = hojeISO();
  // Hoje ainda sem check-in não zera: começa a contar de ontem.
  const ehUtil = (iso: string) => {
    const dia = new Date(iso + "T12:00:00").getDay();
    return dia >= 1 && dia <= 5;
  };
  if (!dias.has(cursor)) cursor = somaDias(cursor, -1);
  while (!ehUtil(cursor)) cursor = somaDias(cursor, -1);

  let streak = 0;
  for (let i = 0; i < 120; i++) {
    if (dias.has(cursor)) streak += 1;
    else break;
    cursor = somaDias(cursor, -1);
    while (!ehUtil(cursor)) cursor = somaDias(cursor, -1);
  }
  return streak;
}

export type Anotacao = {
  id: string;
  data: string; // data_devocional YYYY-MM-DD
  texto: string;
  passagem: string | null;
  titulo: string | null;
};

/**
 * Anotações pessoais do membro ("o que Deus falou"), gravadas no check-in
 * (mem_devocionais.observacoes). Junta com o item pra mostrar a passagem.
 */
export async function listarAnotacoes(membroId: string): Promise<Anotacao[]> {
  const { data, error } = await supabase
    .from("mem_devocionais")
    .select("id, data_devocional, observacoes, devocional_itens(passagem, titulo)")
    .eq("membro_id", membroId)
    .eq("tipo", "pessoal")
    .not("observacoes", "is", null)
    .is("deleted_at", null)
    .order("data_devocional", { ascending: false })
    .limit(100);
  if (error) throw error;
  type Row = { id: string; data_devocional: string; observacoes: string | null; devocional_itens?: { passagem: string | null; titulo: string | null } | { passagem: string | null; titulo: string | null }[] | null };
  return ((data as Row[]) ?? [])
    .filter((r) => (r.observacoes ?? "").trim().length > 0)
    .map((r) => {
      const it = Array.isArray(r.devocional_itens) ? r.devocional_itens[0] : r.devocional_itens;
      return {
        id: r.id,
        data: r.data_devocional,
        texto: (r.observacoes ?? "").trim(),
        passagem: it?.passagem ?? null,
        titulo: it?.titulo ?? null,
      };
    });
}
