import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const m = vi.hoisted(() => ({
  foco: null as null | (() => () => void),
  estado: null as null | ((estado: string) => void),
  definirDia: vi.fn(), remover: vi.fn(),
}));
vi.mock('react', () => ({
  useCallback: (f: unknown) => f,
  useState: (inicial: () => string) => [inicial(), m.definirDia],
}));
vi.mock('@react-navigation/native', () => ({ useFocusEffect: (f: () => () => void) => { m.foco = f; } }));
vi.mock('react-native', () => ({ AppState: {
  currentState: 'active',
  addEventListener: (_tipo: string, f: (estado: string) => void) => { m.estado = f; return { remove: m.remover }; },
} }));
import { useDiaAvisos } from '../lib/useDiaAvisos';
beforeEach(() => { vi.useFakeTimers(); vi.clearAllMocks(); vi.setSystemTime(new Date('2026-11-26T02:59:59Z')); });
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });
it('atualiza na meia-noite do Rio mesmo sem recarregar a lista', async () => {
  expect(useDiaAvisos()).toBe('2026-11-25');
  const sair = m.foco!();
  expect(m.definirDia).toHaveBeenLastCalledWith('2026-11-25');
  await vi.advanceTimersByTimeAsync(1000);
  expect(m.definirDia).toHaveBeenLastCalledWith('2026-11-26');
  sair();
});
it('suspende o relógio em segundo plano e atualiza imediatamente ao retornar', () => {
  useDiaAvisos(); const sair = m.foco!();
  m.estado!('background');
  expect(vi.getTimerCount()).toBe(0);
  vi.setSystemTime(new Date('2026-11-27T12:00:00Z'));
  m.estado!('active');
  expect(m.definirDia).toHaveBeenLastCalledWith('2026-11-27');
  expect(vi.getTimerCount()).toBe(1);
  sair();
});
it('sair da tela remove o timer e a assinatura; reabrir recalcula a data', () => {
  useDiaAvisos(); const sair = m.foco!(); sair();
  expect(vi.getTimerCount()).toBe(0);
  expect(m.remover).toHaveBeenCalledOnce();
  vi.setSystemTime(new Date('2026-11-28T12:00:00Z'));
  const sairDeNovo = m.foco!();
  expect(m.definirDia).toHaveBeenLastCalledWith('2026-11-28');
  sairDeNovo();
});
