import { afterEach, expect, it, vi } from 'vitest';
vi.mock('../lib/api', () => ({ apiGet: vi.fn() }));
import { apiGet } from '../lib/api';
import { agendaDoMes } from '../lib/agendaApi';
afterEach(() => { vi.useRealTimers(); vi.clearAllMocks(); });
it('repassa falha do servidor em vez de representar mês vazio', async () => {
  vi.mocked(apiGet).mockRejectedValue(new Error('503'));
  await expect(agendaDoMes('2026-11')).rejects.toThrow('503');
});
it('rede que não responde libera a tela em vinte segundos', async () => {
  vi.useFakeTimers(); vi.mocked(apiGet).mockReturnValue(new Promise(() => {}));
  const result = expect(agendaDoMes('2026-11')).rejects.toThrow('Tempo esgotado');
  await vi.advanceTimersByTimeAsync(20_000); await result;
  expect(vi.getTimerCount()).toBe(0);
});
