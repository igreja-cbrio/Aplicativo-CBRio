export type AgendaItem = {
  id: string; tipo: "evento" | "calendario"; titulo: string; descricao: string;
  inicio: string; fim: string; hora: string | null; local: string;
  tem_arquivo: boolean; arquivo_mime: string | null; arquivo_nome: string | null;
};
export function mudarMes(mes: string, delta: number): string {
  const [ano, m] = mes.split("-").map(Number);
  return new Date(Date.UTC(ano, m - 1 + delta, 1)).toISOString().slice(0, 7);
}
export function diasDoMes(mes: string): (string | null)[] {
  const [ano, m] = mes.split("-").map(Number);
  const inicio = new Date(Date.UTC(ano, m - 1, 1)).getUTCDay();
  const total = new Date(Date.UTC(ano, m, 0)).getUTCDate();
  const dias: (string | null)[] = Array(inicio).fill(null);
  for (let d = 1; d <= total; d++) dias.push(`${mes}-${String(d).padStart(2, "0")}`);
  while (dias.length % 7) dias.push(null);
  return dias;
}
export function eventosDoDia(itens: AgendaItem[], dia: string | null): AgendaItem[] {
  return itens.filter(i => i.tipo === "evento" && (!dia || (i.inicio <= dia && i.fim >= dia)));
}
export function formatarDataAgenda(data: string, lang: string): string {
  return new Intl.DateTimeFormat(lang, { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${data}T12:00:00Z`));
}
