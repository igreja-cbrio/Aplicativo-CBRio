import { describe, expect, it } from 'vitest';
import { diasDoMes, mudarMes, eventosDoDia, formatarDataAgenda, type AgendaItem } from '../lib/agendaCalendario';
const evento = { id: '1', tipo: 'evento', inicio: '2026-11-30', fim: '2026-12-02' } as AgendaItem;
describe('Agenda: datas civis e eventos com vários dias', () => {
  it('mantém o dia correto e a semana completa em fevereiro bissexto', () => {
    const dias = diasDoMes('2028-02');
    expect(dias.filter(Boolean)).toHaveLength(29);
    expect(dias[2]).toBe('2028-02-01');
    expect(dias.length % 7).toBe(0);
    expect(dias.filter(Boolean).at(-1)).toBe('2028-02-29');
    expect(diasDoMes('2026-02').filter(Boolean)).toHaveLength(28);
  });
  it('atravessa anos nas duas direções sem pular meses', () => {
    expect(mudarMes('2026-12', 1)).toBe('2027-01');
    expect(mudarMes('2026-01', -1)).toBe('2025-12');
  });
  it('inclui o primeiro e o último dia e exclui calendários do filtro de eventos', () => {
    const itens = [evento, { ...evento, tipo: 'calendario' as const }];
    for (const dia of ['2026-11-30', '2026-12-01', '2026-12-02', null]) expect(eventosDoDia(itens, dia)).toEqual([evento]);
    for (const dia of ['2026-11-29', '2026-12-03']) expect(eventosDoDia(itens, dia)).toEqual([]);
  });
  it('não converte a data civil para o dia anterior no fuso do Rio', () => {
    expect(formatarDataAgenda('2026-12-01', 'pt-BR')).toMatch(/^1 de dez/);
    expect(formatarDataAgenda('2026-12-01', 'en')).toBe('Dec 1');
  });
});
