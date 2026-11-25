import { describe, expect, it, vi } from 'vitest';
import { concluirTutorial, podeMostrarTutorial, prepararTutorial, recorteTutorial, tutorialKey } from '../lib/tutorial';

function storage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return { data, getItem: vi.fn(async (key: string) => data.get(key) ?? null), setItem: vi.fn(async (key: string, value: string) => { data.set(key, value); }) };
}
describe('primeiro acesso ao tutorial', () => {
  it('nova instalação prepara convite individual sem criar marca legada global', async () => {
    const store = storage();
    expect(await prepararTutorial(store, 'a')).toBe('pending');
    expect(store.setItem.mock.calls).toEqual([[tutorialKey('a'), 'pending']]);
    expect(await prepararTutorial(store, 'a')).toBe('pending');
    expect(await prepararTutorial(store, 'novo-no-mesmo-aparelho')).toBe('pending');
  });
  it('preserva quem já viu a apresentação antiga', async () => {
    const store = storage({ 'cbrio:onboarding_visto:v1': 'true' });
    expect(await prepararTutorial(store, 'a')).toBe('done');
    expect(await prepararTutorial(store, 'outra-conta-nova')).toBe('pending');
  });
  it('troca rápida de conta não consome a migração duas vezes', async () => {
    const store = storage({ 'cbrio:onboarding_visto:v1': 'true' });
    expect(await Promise.all([prepararTutorial(store, 'legado'), prepararTutorial(store, 'novo')])).toEqual(['done', 'pending']);
  });
  it('não herda conclusão de outra conta nem reinicia tour concluído', async () => {
    const store = storage({ [tutorialKey('a')]: 'done', [tutorialKey('b')]: 'pending' });
    expect(await prepararTutorial(store, 'a')).toBe('done');
    expect(await prepararTutorial(store, 'b')).toBe('pending');
    expect(store.setItem).not.toHaveBeenCalled();
  });
  it('storage indisponível não impede usar o app', async () => {
    const store = storage();
    store.getItem.mockRejectedValue(new Error('offline storage'));
    expect(await prepararTutorial(store, 'a')).toBe('done');
  });
  it('conclusão não insiste nesta sessão mesmo se a gravação falhar', async () => {
    const store = storage({ [tutorialKey('falha-gravacao')]: 'pending' });
    store.setItem.mockRejectedValue(new Error('storage cheio'));
    await concluirTutorial(store, 'falha-gravacao');
    expect(await prepararTutorial(store, 'falha-gravacao')).toBe('done');
  });
});

describe('prioridade dos portões e navegação', () => {
  const ready = { pending: true, ready: true, pushReady: true, cadastroReady: true, home: true, focused: true, active: true, menuOpen: false };
  it('abre somente na Home liberada', () => expect(podeMostrarTutorial(ready)).toBe(true));
  for (const key of ['pending', 'ready', 'pushReady', 'cadastroReady', 'home', 'focused', 'active'] as const) {
    it(`aguarda ${key}`, () => expect(podeMostrarTutorial({ ...ready, [key]: false })).toBe(false));
  }
  it('não disputa apresentação com o menu', () => expect(podeMostrarTutorial({ ...ready, menuOpen: true })).toBe(false));
});

describe('recorte em coordenadas reais', () => {
  const host = { x: 0, y: 24, width: 390, height: 820 };
  it('desconta origem da casca, incluindo status bar Android', () => {
    expect(recorteTutorial({ x: 20, y: 724, width: 65, height: 48 }, host)).toEqual({ x: 16, y: 696, width: 73, height: 56 });
  });
  it('limita alvo parcialmente visível', () => {
    expect(recorteTutorial({ x: 360, y: 724, width: 120, height: 48 }, host)?.width).toBe(34);
  });
  it('não inventa alvo que não foi medido ou saiu da tela', () => {
    expect(recorteTutorial({ x: 500, y: 724, width: 120, height: 48 }, host)).toBeNull();
    expect(recorteTutorial({ x: 0, y: 0, width: 0, height: 0 }, host)).toBeNull();
    expect(recorteTutorial({ x: NaN, y: 0, width: 100, height: 48 }, host)).toBeNull();
  });
});
