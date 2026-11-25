/**
 * LEITURA EM GRUPO · régua pura (25/11/2026 · v2, decisões do Marcos).
 *
 * - A pessoa escolhe UM OU MAIS livros (na ordem que quiser) e, em cada um, de qual a
 *   qual capítulo.
 * - Capítulos SEMPRE inteiros: o número de dias vai de 1 ao total de capítulos
 *   escolhidos. Para ter mais dias, acrescenta-se outro livro.
 * - Os capítulos são distribuídos em sequência, com o corte posto onde o total de
 *   versículos acumulado fica mais perto do ideal (dias de tamanho parecido).
 * - "Incluir sábado e domingo": sem ele, os dias caem de segunda a sexta.
 * - NÃO é pacto de data: a data de cada dia só diz quando ele LIBERA. Dia liberado
 *   pode ser lido a qualquer tempo, e a tela nunca mostra atraso.
 *
 * A divisão (com a data de cada dia) é calculada uma vez, na criação, e gravada no
 * banco. Código PURO (sem react-native, sem supabase): roda no CI.
 */
import { VERSICULOS_POR_CAPITULO } from "./versiculosPorCapitulo";
import { LIVROS_BIBLIA } from "./bibliaLivre";

/** Capítulo inteiro de um livro. `de`/`ate` só existem em leituras da v1 (versículos). */
export type Trecho = { livro?: number; cap: number; de?: number; ate?: number };
export type DiaLeitura = { trechos: Trecho[]; data?: string };
export type LivroEscolhido = { livro: number; cap_inicio: number; cap_fim: number };

export const DIAS_MAX = 365;
export const LIVROS_MAX = 20;

export function versiculosDoCapitulo(livroOrdem: number, cap: number): number {
  return VERSICULOS_POR_CAPITULO[livroOrdem - 1]?.[cap - 1] ?? 0;
}
export function nomeDoLivroOrdem(ordem: number): string {
  return LIVROS_BIBLIA[ordem - 1]?.nome ?? "";
}

/** Total de capítulos da escolha (= máximo de dias). */
export function totalCapitulos(livros: LivroEscolhido[]): number {
  return livros.reduce((s, l) => s + Math.max(0, l.cap_fim - l.cap_inicio + 1), 0);
}
export function maxDias(livros: LivroEscolhido[]): number {
  return Math.min(DIAS_MAX, totalCapitulos(livros));
}

function validarLivros(livros: LivroEscolhido[]): void {
  if (!livros.length || livros.length > LIVROS_MAX) throw new Error("Escolha de 1 a 20 livros.");
  for (const l of livros) {
    const caps = VERSICULOS_POR_CAPITULO[l.livro - 1];
    if (!caps || !Number.isInteger(l.cap_inicio) || !Number.isInteger(l.cap_fim) || l.cap_inicio < 1 || l.cap_fim > caps.length || l.cap_inicio > l.cap_fim) {
      throw new Error("Livro ou capítulos inválidos.");
    }
  }
}

/** Divide os capítulos escolhidos em `dias` dias, só capítulos inteiros. Sem datas. */
export function dividirLeitura(livros: LivroEscolhido[], dias: number): DiaLeitura[] {
  validarLivros(livros);
  const caps = livros.flatMap(l => Array.from({ length: l.cap_fim - l.cap_inicio + 1 }, (_, i) => ({
    livro: l.livro, cap: l.cap_inicio + i, versos: versiculosDoCapitulo(l.livro, l.cap_inicio + i),
  })));
  if (!Number.isInteger(dias) || dias < 1 || dias > Math.min(DIAS_MAX, caps.length)) throw new Error("Número de dias inválido.");
  const acumulado = [0];
  for (const c of caps) acumulado.push(acumulado[acumulado.length - 1] + c.versos);
  const total = acumulado[acumulado.length - 1];
  const saida: DiaLeitura[] = [];
  let inicio = 0;
  for (let d = 1; d <= dias; d++) {
    let fim = caps.length;
    if (d < dias) {
      const ideal = (total * d) / dias;
      // Cada dia tem pelo menos 1 capítulo e sobra pelo menos 1 para cada dia restante.
      const min = inicio + 1, max = caps.length - (dias - d);
      fim = min;
      for (let k = min; k <= max; k++) if (Math.abs(acumulado[k] - ideal) < Math.abs(acumulado[fim] - ideal)) fim = k;
    }
    saida.push({ trechos: caps.slice(inicio, fim).map(c => ({ livro: c.livro, cap: c.cap })) });
    inicio = fim;
  }
  return saida;
}

/** Dia da semana (0 = domingo) de uma data ISO, sem fuso. */
function diaDaSemana(iso: string): number {
  const [a, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d)).getUTCDay();
}
const ehFimDeSemana = (iso: string) => { const w = diaDaSemana(iso); return w === 0 || w === 6; };

/** Soma de dias a uma data ISO (AAAA-MM-DD): aritmética de calendário. */
export function somarDias(iso: string, n: number): string {
  const [a, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d + n)).toISOString().slice(0, 10);
}

/** A data em que cada dia libera. Sem fim de semana, pula sábado e domingo (inclusive no 1º dia). */
export function datasDosDias(dataInicio: string, dias: number, fimDeSemana: boolean): string[] {
  const saida: string[] = [];
  let atual = dataInicio;
  while (saida.length < dias) {
    if (fimDeSemana || !ehFimDeSemana(atual)) saida.push(atual);
    atual = somarDias(atual, 1);
  }
  return saida;
}

/** Divisão completa pra gravar: capítulos por dia + a data de cada dia. */
export function montarDivisao(livros: LivroEscolhido[], dias: number, dataInicio: string, fimDeSemana: boolean): DiaLeitura[] {
  const datas = datasDosDias(dataInicio, dias, fimDeSemana);
  return dividirLeitura(livros, dias).map((d, i) => ({ ...d, data: datas[i] }));
}

/** Data em que o dia libera (a gravada; leituras antigas: início + dia − 1). */
export function dataDoDia(divisao: DiaLeitura[], dataInicio: string, dia: number): string {
  return divisao[dia - 1]?.data || somarDias(dataInicio, dia - 1);
}
/** Dia liberado = a data dele já chegou. Liberado continua liberado para sempre. */
export function diaLiberado(divisao: DiaLeitura[], dataInicio: string, dia: number, hojeISO: string): boolean {
  return dataDoDia(divisao, dataInicio, dia) <= hojeISO;
}
export function diasLiberados(divisao: DiaLeitura[], dataInicio: string, hojeISO: string): number {
  let n = 0;
  for (let d = 1; d <= divisao.length; d++) if (diaLiberado(divisao, dataInicio, d, hojeISO)) n = d;
  return n;
}

/**
 * Próxima leitura DA PESSOA: o primeiro dia liberado que ela ainda não leu. Sem
 * atraso nem cobrança: se ela parou no dia 3, a próxima é o dia 3, seja quando for.
 * `null` com `proximaData` = leu tudo o que já liberou; `null` sem data = leu tudo.
 */
export function proximaLeitura(divisao: DiaLeitura[], dataInicio: string, lidos: number[], hojeISO: string): { dia: number | null; liberaEm: string | null } {
  const feitos = new Set(lidos);
  for (let d = 1; d <= divisao.length; d++) {
    if (feitos.has(d)) continue;
    if (diaLiberado(divisao, dataInicio, d, hojeISO)) return { dia: d, liberaEm: null };
    return { dia: null, liberaEm: dataDoDia(divisao, dataInicio, d) };
  }
  return { dia: null, liberaEm: null };
}

/** "Filipenses 4 · Colossenses 1–2", "Romanos 1–3", "Salmos 119:1–88" (v1). */
export function referenciaDoDia(dia: DiaLeitura, livroPadrao: number): string {
  const t = dia.trechos;
  if (!t.length) return "";
  if (t.length === 1 && t[0].de) {
    const l = t[0].livro ?? livroPadrao;
    return `${nomeDoLivroOrdem(l)} ${t[0].cap}:${t[0].de}–${t[0].ate ?? versiculosDoCapitulo(l, t[0].cap)}`;
  }
  const grupos: { livro: number; primeiro: number; ultimo: number }[] = [];
  for (const x of t) {
    const l = x.livro ?? livroPadrao, g = grupos[grupos.length - 1];
    if (g && g.livro === l && x.cap === g.ultimo + 1) g.ultimo = x.cap;
    else grupos.push({ livro: l, primeiro: x.cap, ultimo: x.cap });
  }
  return grupos.map(g => `${nomeDoLivroOrdem(g.livro)} ${g.primeiro === g.ultimo ? g.primeiro : `${g.primeiro}–${g.ultimo}`}`).join(" · ");
}

/** "Filipenses 1–4 · Colossenses" para listas e convites. */
export function resumoDosLivros(livros: LivroEscolhido[]): string {
  return livros.map(l => {
    const total = VERSICULOS_POR_CAPITULO[l.livro - 1]?.length ?? 0;
    const nome = nomeDoLivroOrdem(l.livro);
    if (l.cap_inicio === 1 && l.cap_fim === total) return nome;
    return l.cap_inicio === l.cap_fim ? `${nome} ${l.cap_inicio}` : `${nome} ${l.cap_inicio}–${l.cap_fim}`;
  }).join(" · ");
}

/** Leituras antigas (v1) não têm `livros`: monta a partir do livro único. */
export function livrosDaLeitura(l: { livros?: LivroEscolhido[] | null; livro_ordem: number; cap_inicio: number; cap_fim: number }): LivroEscolhido[] {
  return l.livros?.length ? l.livros : [{ livro: l.livro_ordem, cap_inicio: l.cap_inicio, cap_fim: l.cap_fim }];
}

/** Código de convite: 6 caracteres, sem 0/O/1/I/L. Normaliza o que a pessoa digitou. */
export function normalizarCodigo(txt: string): string {
  return (txt || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
}

export function textoConvite(params: { titulo: string; dias: number; dataInicio: string; codigo: string; fimDeSemana?: boolean }): string {
  const [a, m, d] = params.dataInicio.split("-");
  const ritmo = params.fimDeSemana === false ? " (de segunda a sexta)" : "";
  return `Bora ler junto? 📖\n\n${params.titulo} em ${params.dias} ${params.dias === 1 ? "dia" : "dias"}${ritmo}, começando em ${d}/${m}/${a}.\n\nEntre pelo app da CBRio:\nhttps://cbrio.org/l/${params.codigo}\n\nOu abra o card Devocional na aba Devocional e toque em Entrar com código: ${params.codigo}`;
}
