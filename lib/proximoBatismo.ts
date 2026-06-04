/**
 * Data do próximo batismo na CBRio: sempre o **4º domingo do mês**.
 * Se hoje já passou do 4º domingo deste mês, retorna o do mês seguinte.
 */

/** Retorna a data (Date) do 4º domingo de um (ano, mês) — mês 0-indexado. */
function quartoDomingoDoMes(ano: number, mes: number): Date {
  const primeiro = new Date(ano, mes, 1);
  const dowPrimeiro = primeiro.getDay(); // 0=domingo
  // dia do mês do 1º domingo
  const diaPrimeiroDomingo = dowPrimeiro === 0 ? 1 : 8 - dowPrimeiro;
  const diaQuarto = diaPrimeiroDomingo + 21;
  return new Date(ano, mes, diaQuarto, 12, 0, 0, 0);
}

export function proximoBatismo(hoje = new Date()): Date {
  const h = new Date(hoje);
  h.setHours(0, 0, 0, 0);
  const desteMes = quartoDomingoDoMes(h.getFullYear(), h.getMonth());
  if (desteMes >= h) return desteMes;
  // Tenta o próximo mês (rolando o ano se for dezembro)
  const m = h.getMonth() + 1;
  const ano = h.getFullYear() + (m > 11 ? 1 : 0);
  const mes = m % 12;
  return quartoDomingoDoMes(ano, mes);
}

const DOW = [
  "Domingo", "Segunda", "Terça", "Quarta",
  "Quinta", "Sexta", "Sábado",
];
const MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

export function formatProximoBatismo(d: Date): string {
  return `${DOW[d.getDay()]}, ${d.getDate()} de ${MESES[d.getMonth()]}`;
}

export function diasAteProximoBatismo(d: Date, hoje = new Date()): number {
  const h = new Date(hoje);
  h.setHours(0, 0, 0, 0);
  const alvo = new Date(d);
  alvo.setHours(0, 0, 0, 0);
  return Math.round((alvo.getTime() - h.getTime()) / 86400000);
}
