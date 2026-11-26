import { apiGet } from './api';
import type { AgendaItem } from './agendaCalendario';
async function comPrazo<T>(pedido: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([pedido, new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('Tempo esgotado ao carregar agenda')), 20_000);
    })]);
  } finally { if (timer) clearTimeout(timer); }
}
export function agendaDoMes(mes: string) {
  return comPrazo(apiGet<{ itens: AgendaItem[] }>(`/app/agenda?mes=${encodeURIComponent(mes)}`));
}
