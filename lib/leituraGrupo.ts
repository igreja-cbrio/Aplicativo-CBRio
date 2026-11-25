/**
 * LEITURA EM GRUPO (25/11/2026 · pedido do Marcos). A pessoa escolhe um livro (ou
 * um intervalo de capítulos), o número de dias e convida quem quiser por link. O
 * app divide a leitura por dia; cada um marca "Li" e todos veem quem já leu.
 *
 * Régua da divisão (decisão do Marcos: "capítulos inteiros"):
 *  - dias <= capítulos → cada dia recebe capítulos INTEIROS, com o corte posto onde
 *    o total de versículos acumulado fica mais perto do ideal (dias de tamanho parecido);
 *  - dias > capítulos → não dá pra dar um capítulo por dia, então os capítulos
 *    maiores são partidos em blocos de versículos (proporcional ao tamanho).
 * A divisão é calculada UMA vez, na criação, e gravada no banco (`divisao`): quem
 * entra depois vê exatamente o mesmo plano.
 *
 * Código PURO (sem react-native, sem supabase): roda no CI.
 */
import { VERSICULOS_POR_CAPITULO } from "./versiculosPorCapitulo";

/** Um pedaço de leitura: capítulo inteiro, ou versículos `de`..`ate` dele. `ate` ausente = até o fim. */
export type Trecho = { cap: number; de?: number; ate?: number };
export type DiaLeitura = { trechos: Trecho[] };

export const DIAS_MAX = 365;

export function versiculosDoCapitulo(livroOrdem: number, cap: number): number {
  return VERSICULOS_POR_CAPITULO[livroOrdem - 1]?.[cap - 1] ?? 0;
}

/** Divide os capítulos capIni..capFim do livro (1 a 66) em `dias` dias. */
export function dividirLeitura(livroOrdem: number, capIni: number, capFim: number, dias: number): DiaLeitura[] {
  const capitulos = VERSICULOS_POR_CAPITULO[livroOrdem - 1];
  if (!capitulos) throw new Error("Livro inválido.");
  if (!Number.isInteger(capIni) || !Number.isInteger(capFim) || capIni < 1 || capFim > capitulos.length || capIni > capFim) throw new Error("Capítulos inválidos.");
  const caps = Array.from({ length: capFim - capIni + 1 }, (_, i) => ({ cap: capIni + i, versos: capitulos[capIni + i - 1] }));
  const total = caps.reduce((s, c) => s + c.versos, 0);
  if (!Number.isInteger(dias) || dias < 1 || dias > Math.min(DIAS_MAX, total)) throw new Error("Número de dias inválido.");

  if (dias <= caps.length) {
    const acumulado = [0];
    for (const c of caps) acumulado.push(acumulado[acumulado.length - 1] + c.versos);
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
      saida.push({ trechos: caps.slice(inicio, fim).map(c => ({ cap: c.cap })) });
      inicio = fim;
    }
    return saida;
  }

  // Mais dias que capítulos: quantas partes cada capítulo vira (≥1, ≤ versos, soma = dias).
  const partes = caps.map(() => 1);
  let sobra = dias - caps.length;
  while (sobra > 0) {
    // Dá a próxima parte ao capítulo cujo bloco atual é o maior.
    let melhor = -1;
    for (let i = 0; i < caps.length; i++) {
      if (partes[i] >= caps[i].versos) continue;
      if (melhor < 0 || caps[i].versos / partes[i] > caps[melhor].versos / partes[melhor]) melhor = i;
    }
    partes[melhor] += 1;
    sobra -= 1;
  }
  const saida: DiaLeitura[] = [];
  caps.forEach((c, i) => {
    const n = partes[i];
    if (n === 1) { saida.push({ trechos: [{ cap: c.cap }] }); return; }
    let de = 1;
    for (let p = 0; p < n; p++) {
      const tamanho = Math.floor(c.versos / n) + (p < c.versos % n ? 1 : 0);
      const ate = de + tamanho - 1;
      // O último bloco vai "até o fim": versões com contagem diferente não perdem versículo.
      saida.push({ trechos: [p === n - 1 ? { cap: c.cap, de } : { cap: c.cap, de, ate }] });
      de = ate + 1;
    }
  });
  return saida;
}

/** "Romanos 1–3", "Salmos 119:1–88", "Salmos 119:89–fim" virando "Salmos 119:89–176". */
export function referenciaDoDia(livroNome: string, livroOrdem: number, dia: DiaLeitura): string {
  const t = dia.trechos;
  if (!t.length) return livroNome;
  if (t.length === 1 && t[0].de) {
    const ate = t[0].ate ?? versiculosDoCapitulo(livroOrdem, t[0].cap);
    return `${livroNome} ${t[0].cap}:${t[0].de}–${ate}`;
  }
  const primeiro = t[0].cap, ultimo = t[t.length - 1].cap;
  return primeiro === ultimo ? `${livroNome} ${primeiro}` : `${livroNome} ${primeiro}–${ultimo}`;
}

/** Soma de dias a uma data ISO (AAAA-MM-DD), sem fuso: aritmética de calendário. */
export function somarDias(iso: string, n: number): string {
  const [a, m, d] = iso.split("-").map(Number);
  const x = new Date(Date.UTC(a, m - 1, d + n));
  return x.toISOString().slice(0, 10);
}

/** Qual dia (1..dias) é hoje na leitura. 0 = ainda não começou; dias+1 = já terminou. */
export function diaAtual(dataInicio: string, dias: number, hojeISO: string): number {
  const [a1, m1, d1] = dataInicio.split("-").map(Number), [a2, m2, d2] = hojeISO.split("-").map(Number);
  const diff = Math.round((Date.UTC(a2, m2 - 1, d2) - Date.UTC(a1, m1 - 1, d1)) / 86400000);
  if (diff < 0) return 0;
  return Math.min(diff + 1, dias + 1);
}

/** Dia liberado para marcar como lido: hoje ou antes (o servidor aplica a mesma régua). */
export function diaLiberado(dia: number, dataInicio: string, hojeISO: string): boolean {
  return somarDias(dataInicio, dia - 1) <= hojeISO;
}

/** Código de convite: 6 caracteres, sem 0/O/1/I/L. Normaliza o que a pessoa digitou. */
export function normalizarCodigo(txt: string): string {
  return (txt || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
}

export function textoConvite(params: { titulo: string; dias: number; dataInicio: string; codigo: string }): string {
  const [a, m, d] = params.dataInicio.split("-");
  return `Bora ler junto? 📖\n\n${params.titulo} em ${params.dias} ${params.dias === 1 ? "dia" : "dias"}, começando em ${d}/${m}/${a}.\n\nEntre pelo app da CBRio:\nhttps://cbrio.org/l/${params.codigo}\n\nOu em Devocional → Planos de leitura → Entrar com código: ${params.codigo}`;
}
