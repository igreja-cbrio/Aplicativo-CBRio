/**
 * Régua PURA do plano de leitura POR INSCRIÇÃO (ex.: "Valores de Cristo",
 * 5 dias em Atos 2.42). Diferente dos planos por CALENDÁRIO (Devocional da
 * semana, Quarta com Deus), aqui a pessoa começa quando quer e segue no seu
 * ritmo: o dia N só abre depois que o dia N-1 foi lido.
 *
 * ⚠️ Os itens desses planos têm `data` SENTINELA (2000-01-0N) — nunca casa
 * com "hoje", então o push diário e o Devocional da semana não os enxergam.
 * A ORDEM vem de `ordem_no_ciclo`, e a data só desempata.
 *
 * Vive em lib/ (sem react-native) pra entrar no portão — a tela só desenha.
 */
export type ItemOrdenavel = { id: string; ordem_no_ciclo: number | null; data: string };
export type EstadoDia = "lido" | "atual" | "bloqueado";
export type DiaDoPlano<T extends ItemOrdenavel> = { item: T; numero: number; estado: EstadoDia };

/** Ordena por `ordem_no_ciclo` (nulos por último) e desempata por `data`. */
export function ordenarItensDoPlano<T extends ItemOrdenavel>(itens: T[]): T[] {
  return [...itens].sort((a, b) => {
    const oa = a.ordem_no_ciclo ?? Number.MAX_SAFE_INTEGER;
    const ob = b.ordem_no_ciclo ?? Number.MAX_SAFE_INTEGER;
    if (oa !== ob) return oa - ob;
    return a.data.localeCompare(b.data);
  });
}

/**
 * Classifica cada dia: `lido` (está em `lidos`), `atual` (o PRIMEIRO não lido —
 * é o único que a pessoa pode abrir) e `bloqueado` (os seguintes).
 * ⚠️ Um item lido fora de ordem continua contando como lido — o que se lê não
 * se desfaz; o "atual" é sempre o primeiro buraco.
 */
export function diasDoPlano<T extends ItemOrdenavel>(itens: T[], lidos: Iterable<string>): DiaDoPlano<T>[] {
  const set = new Set(lidos);
  let atualDefinido = false;
  return ordenarItensDoPlano(itens).map((item, i) => {
    if (set.has(item.id)) return { item, numero: i + 1, estado: "lido" as const };
    if (!atualDefinido) { atualDefinido = true; return { item, numero: i + 1, estado: "atual" as const }; }
    return { item, numero: i + 1, estado: "bloqueado" as const };
  });
}

/** `lidos/total` e se o plano fechou (tudo lido). Total 0 nunca é "concluído". */
export function progressoDoPlano(dias: { estado: EstadoDia }[]): { lidos: number; total: number; concluido: boolean } {
  const lidos = dias.filter((d) => d.estado === "lido").length;
  return { lidos, total: dias.length, concluido: dias.length > 0 && lidos === dias.length };
}

/** Pode abrir este dia? Só o lido (revisitar) e o atual. */
export function podeAbrirDia(estado: EstadoDia): boolean {
  return estado !== "bloqueado";
}

// ── SEMANAS do plano longo (25/09/2026 · pedido do Marcos) ──────────────────
// "Para devocionais mais longos do que uma semana, separar em cima em semana 1,
// 2, 3… e quando todos de uma semana são finalizados eles vão para o próximo."
// A semana é por POSIÇÃO no plano (dias 1–7, 8–14…), não pelo calendário: o
// plano por inscrição é "no seu ritmo", então a data não diz nada.
export const DIAS_POR_SEMANA = 7;
export type SemanaDoPlano<T extends ItemOrdenavel> = {
  numero: number; dias: DiaDoPlano<T>[]; lidos: number; completa: boolean;
};

/** Agrupa os dias em semanas de 7. Plano de até 7 dias não tem semanas ([]). */
export function semanasDoPlano<T extends ItemOrdenavel>(dias: DiaDoPlano<T>[], tamanho = DIAS_POR_SEMANA): SemanaDoPlano<T>[] {
  if (dias.length <= tamanho) return [];
  const semanas: SemanaDoPlano<T>[] = [];
  for (let i = 0; i < dias.length; i += tamanho) {
    const bloco = dias.slice(i, i + tamanho);
    const lidos = bloco.filter((d) => d.estado === "lido").length;
    semanas.push({ numero: semanas.length + 1, dias: bloco, lidos, completa: lidos === bloco.length });
  }
  return semanas;
}

/**
 * A semana que a tela abre: a PRIMEIRA ainda não completa. É isso que faz o
 * leitor "ir pro próximo" sozinho quando fecha uma semana. Tudo lido ⇒ a
 * última (onde ele terminou), nunca uma semana que não existe.
 */
export function semanaEmFoco(semanas: { numero: number; completa: boolean }[]): number {
  if (semanas.length === 0) return 1;
  return (semanas.find((s) => !s.completa) ?? semanas[semanas.length - 1]).numero;
}

// ── PLANO POR CALENDÁRIO na MESMA tela (25/09/2026 · pedido do Marcos) ──────
// "Essa nossa estética de Valores de Cristo universal para todos os planos,
// inclusive o de Quarta com Deus." Todo plano abre em /devocional-plano; o que
// muda é o RITMO, e ele é lido do DADO, não do título:
//   · datas SENTINELA (ano 2000) ⇒ "ritmo": no seu ritmo, um dia libera o outro;
//   · datas reais                ⇒ "calendario": a data manda — hoje e antes
//     abrem, o futuro fica trancado com a data em que abre.
// ⚠️ Não é `continuo`: as edições antigas do "Devocional da semana" têm
// `continuo=false` e datas reais, e são de calendário.
export type Ritmo = "ritmo" | "calendario";
export function ritmoDoPlano(itens: { data: string }[]): Ritmo {
  if (itens.length === 0) return "ritmo";
  return itens.every((i) => i.data < "2001-01-01") ? "ritmo" : "calendario";
}

export type ItemCalendario = ItemOrdenavel & { edicao_slug?: string | null; edicao_titulo?: string | null };
export type EdicaoDoPlano<T extends ItemCalendario> = {
  chave: string; titulo: string | null; inicio: string; fim: string;
  dias: DiaDoPlano<T>[]; lidos: number; completa: boolean;
};

/** Segunda-feira da semana de uma data YYYY-MM-DD (aritmética de calendário, sem fuso). */
function segundaDe(iso: string): string {
  const [a, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(a, m - 1, d));
  const dow = dt.getUTCDay();
  dt.setUTCDate(dt.getUTCDate() - (dow === 0 ? 6 : dow - 1));
  return dt.toISOString().slice(0, 10);
}

/**
 * Agrupa por EDIÇÃO (`edicao_slug`; sem ela, a semana da data). Dentro da
 * edição, ordem por data. Estado: lido · aberto (`atual`: data ≤ hoje) ·
 * trancado (`bloqueado`: data futura). Edições da MAIS NOVA pra mais antiga.
 * ⚠️ `hoje` é YYYY-MM-DD e a comparação é de STRING — `new Date(data)` é
 * meia-noite UTC e no Rio vira o dia anterior.
 */
export function edicoesDoCalendario<T extends ItemCalendario>(itens: T[], lidos: Iterable<string>, hoje: string): EdicaoDoPlano<T>[] {
  const set = new Set(lidos);
  const grupos = new Map<string, T[]>();
  for (const it of itens) {
    const chave = it.edicao_slug || `semana:${segundaDe(it.data)}`;
    const g = grupos.get(chave);
    if (g) g.push(it); else grupos.set(chave, [it]);
  }
  const edicoes: EdicaoDoPlano<T>[] = [];
  for (const [chave, lista] of grupos) {
    const ord = [...lista].sort((a, b) => a.data.localeCompare(b.data));
    const dias = ord.map((item, i) => ({
      item, numero: i + 1,
      estado: (set.has(item.id) ? "lido" : item.data <= hoje ? "atual" : "bloqueado") as EstadoDia,
    }));
    const lidosN = dias.filter((d) => d.estado === "lido").length;
    edicoes.push({
      chave, titulo: ord.find((x) => x.edicao_titulo)?.edicao_titulo ?? null,
      inicio: ord[0].data, fim: ord[ord.length - 1].data,
      dias, lidos: lidosN, completa: lidosN === dias.length,
    });
  }
  return edicoes.sort((a, b) => b.inicio.localeCompare(a.inicio));
}

/** A edição que a tela abre: a que contém hoje → a mais recente que já começou → a primeira. */
export function edicaoEmFoco(edicoes: { chave: string; inicio: string; fim: string }[], hoje: string): string | null {
  if (edicoes.length === 0) return null;
  const agora = edicoes.find((e) => e.inicio <= hoje && hoje <= e.fim);
  if (agora) return agora.chave;
  const passada = edicoes.find((e) => e.inicio <= hoje);
  return (passada ?? edicoes[edicoes.length - 1]).chave;
}
