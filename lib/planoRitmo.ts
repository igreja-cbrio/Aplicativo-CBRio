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
