// ============================================================================
// MONTAR ESCALA · a régua do TIME (23/09/2026 · o pedido do vídeo de 03/09)
//
// ⚠️⚠️ POR QUE ISTO EXISTE. Marcos comparou a nossa "Montar escala" com o
// Planning Center Services e pediu (voz, autoritativo): agrupar por TIME e não
// por cargo ("hoje tá vendo adultos, baixistas — teria que ser separado por
// times"), escolher o culto em DUAS etapas (tipo → data), um carrossel
// horizontal de equipes e a VAGA visível ("2 Needed"). A tela antiga agrupava
// pela string `team_name` de cada linha da escala — e nas linhas importadas do
// Planning Center essa string é o NOME DA POSIÇÃO ("Vocal", "Chat 9:30",
// "Câmeras"), porque lá o "team" é o nosso cargo. Medido em 23/09 no Domingo -
// Manhã de 27/09: 69 escalas, 21 nomes distintos de `team_name` que NÃO são
// equipe nenhuma. O supervisor via 21 "equipes" de uma pessoa cada.
//
// A fonte do TIME é `vol_teams` (via `team_id`) e a fonte da VAGA é a
// composição do culto (`vol_escala_culto_itens`: equipe × posição × quantidade)
// que o servidor já devolvia em `composicao` desde 25/08 — a tela lia um campo
// `equipes` que o servidor NUNCA mandou, por isso "área vazia" nunca apareceu.
//
// ⚠️ Régua PURA, em lib/, porque arquivo que importa react-native não roda no
// portão (a lei da casa). A tela só desenha o que estas funções devolvem.
// ============================================================================

export type LinhaEscala = {
  id: string;
  volunteer_id: string | null;
  volunteer_name: string;
  team_id?: string | null;
  team_name: string | null;
  position_id?: string | null;
  position_name: string | null;
  confirmation_status: string | null;
  recusa_motivo?: string | null;
  area?: string | null;
  foto_url?: string | null;
};

export type ItemComposicao = {
  team_id: string | null;
  team_name: string;
  area: string | null;
  position_id: string | null;
  position_name: string | null;
  quantidade: number;
};

export type CultoAgendado = {
  id: string;
  service_type_name: string | null;
  scheduled_at: string | null;
  escalados?: number;
};

export type PosicaoDoTime = {
  /** Chave estável pra `key` e pro alvo do arraste. */
  chave: string;
  position_id: string | null;
  /** `null` = a linha "Equipe toda" / sem função. */
  nome: string | null;
  /** Quantas a composição pede. 0 = ninguém pediu (grupo só de gente). */
  alvo: number;
  pessoas: LinhaEscala[];
  preenchidas: number;
  faltam: number;
};

export type Time = {
  /** Chave estável: `team_id` quando há, senão `n:<nome>`. */
  chave: string;
  team_id: string | null;
  nome: string;
  area: string | null;
  posicoes: PosicaoDoTime[];
  total: number;
  confirmados: number;
  recusados: number;
  pendentes: number;
  alvo: number;
  faltam: number;
};

export type TipoDeCulto = { tipo: string; cultos: CultoAgendado[] };

/** Rótulo do culto sem tipo — a tela traduz na hora de mostrar. */
export const SEM_TIPO = "Culto";
/** Sentinela da equipe que nenhuma linha resolve — a tela traduz ao mostrar. */
export const SEM_EQUIPE = "Sem equipe";
/** Chave da linha "sem função" dentro de um time. */
export const SEM_FUNCAO = "sem-funcao";

// ─── Etapa 1 → 2: tipo de culto, depois a data ─────────────────────────────

/**
 * Agrupa os próximos cultos pelo TIPO, na ordem em que cada tipo acontece pela
 * primeira vez — o tipo do culto mais próximo vem primeiro, que é onde o
 * supervisor quase sempre quer estar. Dentro do tipo, as datas ficam na ordem
 * em que o servidor mandou (crescente).
 *
 * ⚠️ A lista é a NOSSA (`vol_services`), não a do Planning Center: "não é para
 * ter esses cultos, é para ter só os que estão no nosso aplicativo mesmo".
 */
export function agruparCultosPorTipo(cultos: CultoAgendado[]): TipoDeCulto[] {
  const porTipo = new Map<string, CultoAgendado[]>();
  for (const c of cultos) {
    const k = (c.service_type_name || "").trim() || SEM_TIPO;
    const arr = porTipo.get(k);
    if (arr) arr.push(c);
    else porTipo.set(k, [c]);
  }
  // `Map` preserva a ordem de inserção = ordem do 1º culto de cada tipo.
  return [...porTipo.entries()].map(([tipo, lista]) => ({ tipo, cultos: lista }));
}

/**
 * Qual culto selecionar ao trocar de tipo (ou ao abrir a tela): o MAIS PRÓXIMO
 * daquele tipo. Sem tipo escolhido, o mais próximo de todos.
 */
export function cultoInicial(grupos: TipoDeCulto[], tipo: string | null): CultoAgendado | null {
  if (tipo) {
    const g = grupos.find((x) => x.tipo === tipo);
    return g?.cultos[0] ?? null;
  }
  return grupos[0]?.cultos[0] ?? null;
}

// ─── A vaga ──────────────────────────────────────────────────────────────────

/**
 * ⚠️⚠️ QUEM RECUSOU NÃO PREENCHE A VAGA — a mesma régua de
 * `backend/utils/volCobertura.js` (21/08/2026). Antes dela a web mostrava o
 * lugar OCUPADO por quem acabou de dizer que não vai (27 escalas futuras
 * recusadas, nenhuma reabrindo vaga). A pessoa continua listada, marcada como
 * "recusou" — sumir com ela faria o supervisor perder quem era e por que a vaga
 * abriu, que é justamente o que ele precisa pra repor.
 */
export function contaVaga(status: string | null | undefined): boolean {
  return status !== "declined";
}

// ─── O time ──────────────────────────────────────────────────────────────────

const norm = (s: string | null | undefined) => (s || "").trim().toLocaleLowerCase("pt-BR");

/**
 * A que time a linha pertence.
 *
 * ⚠️⚠️ A ORDEM DAS CHAVES É A RÉGUA, não um detalhe:
 * 1. `team_name` que É o nome de um time conhecido — porque o `PATCH` do app
 *    (mover de equipe) grava só o NOME e deixa `team_id` velho: quem foi movido
 *    pelo app tem `team_id` apontando pro time de ONDE saiu. O nome é a escrita
 *    mais recente.
 * 2. `team_id` — o caso das 1.000+ linhas importadas do Planning Center, cujo
 *    `team_name` é o nome da POSIÇÃO ("Vocal", "Chat 9:30") e cujo `team_id` é o
 *    que diz que aquilo é Banda/Online.
 * 3. Nada casou: fica com o próprio nome (ou `SEM_EQUIPE`), pra não sumir.
 */
export function chaveDoTime(
  linha: Pick<LinhaEscala, "team_id" | "team_name">,
  porNome: Map<string, string>,
  porId: Set<string>,
): string {
  const n = norm(linha.team_name);
  const pelaNome = n ? porNome.get(n) : undefined;
  if (pelaNome) return pelaNome;
  if (linha.team_id && porId.has(linha.team_id)) return linha.team_id;
  return `n:${(linha.team_name || "").trim() || SEM_EQUIPE}`;
}

/**
 * Monta a árvore TIME → POSIÇÃO → PESSOA a partir da composição do culto (o
 * alvo) e das escalas (o realizado). Times vêm na ordem da composição; quem
 * está escalado num time que a composição não pede vem depois, pra não sumir
 * ("quem sobrou não pode sumir" — a lei do `montarCobertura`).
 *
 * Posição: casa por `position_id`, senão pelo NOME (sem caixa/espaços — a
 * grafia já divergiu: `Câmeras` × `Câmeras ` no import). Linha sem posição, ou
 * com posição que a composição não pede, cai em "sem função" do time.
 */
export function montarTimes(composicao: ItemComposicao[], escalas: LinhaEscala[]): Time[] {
  const times = new Map<string, Time>();
  const porNome = new Map<string, string>(); // nome normalizado → chave
  const porId = new Set<string>();

  const garantirTime = (chave: string, team_id: string | null, nome: string, area: string | null): Time => {
    let t = times.get(chave);
    if (!t) {
      t = { chave, team_id, nome, area, posicoes: [], total: 0, confirmados: 0, recusados: 0, pendentes: 0, alvo: 0, faltam: 0 };
      times.set(chave, t);
    }
    return t;
  };

  // 1 · o alvo: cada item da composição vira uma posição do seu time.
  for (const item of composicao) {
    const chave = item.team_id || `n:${item.team_name || SEM_EQUIPE}`;
    const t = garantirTime(chave, item.team_id, item.team_name || SEM_EQUIPE, item.area);
    if (item.team_id) porId.add(item.team_id);
    porNome.set(norm(t.nome), chave);
    const chavePos = item.position_id || (item.position_name ? `p:${norm(item.position_name)}` : SEM_FUNCAO);
    let pos = t.posicoes.find((p) => p.chave === chavePos);
    if (!pos) {
      pos = { chave: chavePos, position_id: item.position_id, nome: item.position_name || null, alvo: 0, pessoas: [], preenchidas: 0, faltam: 0 };
      t.posicoes.push(pos);
    }
    // Dois itens pra mesma posição (ex.: time split, um por horário) SOMAM.
    pos.alvo += Math.max(0, item.quantidade || 0);
  }

  // 2 · o realizado: cada linha cai no seu time e na sua posição.
  for (const e of escalas) {
    const chave = chaveDoTime(e, porNome, porId);
    const t = garantirTime(chave, e.team_id ?? null, (e.team_name || "").trim() || SEM_EQUIPE, e.area ?? null);
    let pos =
      (e.position_id ? t.posicoes.find((p) => p.position_id && p.position_id === e.position_id) : undefined) ??
      (e.position_name ? t.posicoes.find((p) => p.nome && norm(p.nome) === norm(e.position_name)) : undefined);
    if (!pos) {
      pos = t.posicoes.find((p) => p.chave === SEM_FUNCAO);
      if (!pos) {
        pos = { chave: SEM_FUNCAO, position_id: null, nome: null, alvo: 0, pessoas: [], preenchidas: 0, faltam: 0 };
        t.posicoes.push(pos);
      }
    }
    pos.pessoas.push(e);
  }

  // 3 · contagens. "Sem função" vai pro fim; o resto fica na ordem da composição.
  for (const t of times.values()) {
    for (const p of t.posicoes) {
      p.pessoas.sort((a, b) => a.volunteer_name.localeCompare(b.volunteer_name, "pt-BR"));
      p.preenchidas = p.pessoas.filter((x) => contaVaga(x.confirmation_status)).length;
      p.faltam = Math.max(0, p.alvo - p.preenchidas);
    }
    t.posicoes.sort((a, b) => Number(a.chave === SEM_FUNCAO) - Number(b.chave === SEM_FUNCAO));
    const todas = t.posicoes.flatMap((p) => p.pessoas);
    t.total = todas.length;
    t.confirmados = todas.filter((x) => x.confirmation_status === "confirmed").length;
    t.recusados = todas.filter((x) => x.confirmation_status === "declined").length;
    t.pendentes = t.total - t.confirmados - t.recusados;
    t.alvo = t.posicoes.reduce((s, p) => s + p.alvo, 0);
    t.faltam = t.posicoes.reduce((s, p) => s + p.faltam, 0);
  }

  return [...times.values()];
}

export type ResumoDoCulto = { total: number; confirmados: number; recusados: number; faltam: number };

export function resumoDoCulto(times: Time[]): ResumoDoCulto {
  return {
    total: times.reduce((s, t) => s + t.total, 0),
    confirmados: times.reduce((s, t) => s + t.confirmados, 0),
    recusados: times.reduce((s, t) => s + t.recusados, 0),
    faltam: times.reduce((s, t) => s + t.faltam, 0),
  };
}

/**
 * Pra onde a linha vai quando o supervisor solta o nome em cima de um TIME.
 * Devolve `null` quando soltar não muda nada (mesmo time) — a tela então não
 * chama o servidor nem anima.
 *
 * ⚠️ O servidor recebe o NOME do time (é assim que `PATCH /escala/:id` casa
 * a equipe e checa a supervisão). Time sem nome de verdade (`n:`) não é destino.
 */
export function destinoDoArraste(linha: LinhaEscala, times: Time[], chaveAlvo: string): { team_name: string } | null {
  const alvo = times.find((t) => t.chave === chaveAlvo);
  if (!alvo || alvo.chave.startsWith("n:")) return null;
  const porNome = new Map(times.map((t) => [norm(t.nome), t.chave] as const));
  const porId = new Set(times.map((t) => t.team_id).filter((x): x is string => !!x));
  if (chaveDoTime(linha, porNome, porId) === chaveAlvo) return null;
  return { team_name: alvo.nome };
}

/**
 * Onde a barra de times tem que rolar pra deixar o chip do time aberto no
 * CENTRO da tela. Pedido do Marcos (23/09): a barra acompanha o carrossel —
 * "se eu estou em Cuidados, as opções ali em cima não podem estar mostrando
 * Pastores". Nunca negativo: o primeiro chip fica encostado à esquerda.
 */
export function xParaCentralizar(chipX: number, chipLargura: number, larguraVisivel: number): number {
  return Math.max(0, Math.round(chipX + chipLargura / 2 - larguraVisivel / 2));
}

// ── Preferência de semana (24/09/2026 · pedido do Marcos) ─────────────────────
// "cada um tem um domingo de preferência e ao clicar para escalar naquela
// posição, ele filtra as pessoas que estão naquele time priorizando quem
// colocou aquele domingo como rodízio". O SERVIDOR ordena a lista do time; a
// tela só precisa saber de que semana é o culto (pra dizer "quem prefere o 4º
// domingo vem primeiro") e filtrar localmente pelo nome enquanto a pessoa digita.

/** Data/hora de Brasília a partir do ISO. BRT é UTC−3 sem horário de verão desde 2019. */
function partesBRT(iso: string | null | undefined): { dia: number; semanaDia: number } | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const brt = new Date(d.getTime() - 3 * 3600 * 1000);
  return { dia: brt.getUTCDate(), semanaDia: brt.getUTCDay() };
}

/**
 * Semana do mês (1..4) do culto, no fuso da casa. A 5ª ocorrência vira 1ª —
 * decisão do Matheus (25/08): "repete o 1º". É a mesma conta do servidor
 * (`rodizioCulto.semanaDoRodizio`); divergir aqui faria a tela anunciar uma
 * semana e a lista vir ordenada por outra.
 */
export function semanaDoCulto(iso: string | null | undefined): number | null {
  const p = partesBRT(iso);
  if (!p) return null;
  const ord = Math.ceil(p.dia / 7);
  return ord > 4 ? 1 : ord;
}

/** O culto cai num domingo (no fuso da casa)? Decide se a tela fala "domingo" ou "semana do mês". */
export function ehDomingo(iso: string | null | undefined): boolean {
  const p = partesBRT(iso);
  return !!p && p.semanaDia === 0;
}

function semAcento(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

/**
 * Filtra a lista do time pelo nome, sem acento e sem caixa, PRESERVANDO A
 * ORDEM que o servidor mandou (a preferência). Busca vazia devolve tudo.
 */
export function filtrarPool<T extends { full_name: string }>(pool: T[], q: string): T[] {
  const alvo = semAcento(q || "");
  if (!alvo) return pool;
  return pool.filter((p) => semAcento(p.full_name || "").includes(alvo));
}

/**
 * Divide a lista do time em "quem é DESSA vaga" e "resto do time" (pedido do
 * Marcos, 24/09: "estou escalando um saxofonista: primeiro os saxofonistas da
 * igreja, abaixo outras pessoas do time"). A ORDEM de cada metade é a que veio
 * (a preferência de semana) — só separa, não reordena.
 *
 * Casa pelo `position_id` da vaga ou, sem id, pelo NOME sem acento/caixa —
 * a composição do culto e o vínculo do time nem sempre apontam pro mesmo id.
 * Sem vaga (a pessoa tocou em "Adicionar" no time, sem função, ou digitou uma
 * função livre) devolve tudo em `resto` — não há o que separar.
 */
export function dividirPorVaga<T extends { posicoes?: { id: string; name: string | null }[] }>(
  pool: T[],
  vaga: { id?: string | null; nome?: string | null } | null | undefined,
): { daVaga: T[]; resto: T[] } {
  const id = vaga?.id ? String(vaga.id) : null;
  const nome = vaga?.nome ? semAcento(vaga.nome) : "";
  if (!id && !nome) return { daVaga: [], resto: pool };
  const daVaga: T[] = []; const resto: T[] = [];
  for (const p of pool) {
    const tem = (p.posicoes ?? []).some((f) => (id && String(f.id) === id) || (!!nome && semAcento(f.name || "") === nome));
    (tem ? daVaga : resto).push(p);
  }
  return { daVaga, resto };
}
