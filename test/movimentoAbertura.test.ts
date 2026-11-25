import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  consultar: vi.fn(), iniciar: vi.fn(), parar: vi.fn(), setValue: vi.fn(),
  removerMovimento: vi.fn(), removerEstado: vi.fn(),
  movimento: (_value: boolean) => {}, estado: (_value: string) => {},
}));
vi.mock('react-native', () => ({
  AccessibilityInfo: {
    isReduceMotionEnabled: h.consultar,
    addEventListener: (_event: string, fn: (value: boolean) => void) => {
      h.movimento = fn; return { remove: h.removerMovimento };
    },
  },
  AppState: {
    currentState: 'active',
    addEventListener: (_event: string, fn: (value: string) => void) => {
      h.estado = fn; return { remove: h.removerEstado };
    },
  },
  Animated: {
    Value: class { setValue = h.setValue; },
    timing: vi.fn(), sequence: vi.fn(),
    loop: () => ({ start: h.iniciar, stop: h.parar }),
  },
  Easing: { sin: vi.fn(), inOut: vi.fn() },
}));
import { useMovimentoAbertura } from '../lib/useMovimentoAbertura';
function Tela() { useMovimentoAbertura(); return null; }
let tree: ReactTestRenderer | undefined;
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  h.consultar.mockResolvedValue(false);
});
afterEach(async () => {
  if (tree) await act(async () => tree?.unmount());
  tree = undefined;
  vi.unstubAllGlobals();
});
async function montar() { await act(async () => { tree = create(React.createElement(Tela)); }); }

describe('movimento de abertura e acessibilidade', () => {
  it('começa estático e não anima quando Reduzir Movimento está ativo', async () => {
    let resolver!: (value: boolean) => void;
    h.consultar.mockReturnValue(new Promise<boolean>((r) => { resolver = r; }));
    await montar();
    expect(h.iniciar).not.toHaveBeenCalled();
    await act(async () => resolver(true));
    expect(h.iniciar).not.toHaveBeenCalled();
  });
  it('interrompe e restaura escala ao ativar Reduzir Movimento', async () => {
    await montar();
    expect(h.iniciar).toHaveBeenCalledOnce();
    await act(async () => h.movimento(true));
    expect(h.parar).toHaveBeenCalledOnce();
    expect(h.setValue).toHaveBeenLastCalledWith(1);
    expect(h.iniciar).toHaveBeenCalledOnce();
  });
  it('uma resposta antiga não sobrescreve a preferência mais recente', async () => {
    let resolver!: (value: boolean) => void;
    h.consultar.mockReturnValue(new Promise<boolean>((r) => { resolver = r; }));
    await montar();
    await act(async () => h.movimento(true));
    await act(async () => resolver(false));
    expect(h.iniciar).not.toHaveBeenCalled();
  });
  it('pausa fora da tela e retoma apenas em primeiro plano', async () => {
    await montar();
    await act(async () => h.estado('background'));
    expect(h.parar).toHaveBeenCalledOnce();
    await act(async () => h.estado('active'));
    expect(h.iniciar).toHaveBeenCalledTimes(2);
  });
  it('remove listeners e não inicia animação após desmontar', async () => {
    let resolver!: (value: boolean) => void;
    h.consultar.mockReturnValue(new Promise<boolean>((r) => { resolver = r; }));
    await montar();
    await act(async () => tree?.unmount());
    tree = undefined;
    await act(async () => resolver(false));
    expect(h.iniciar).not.toHaveBeenCalled();
    expect(h.removerMovimento).toHaveBeenCalledOnce();
    expect(h.removerEstado).toHaveBeenCalledOnce();
  });
  it('mantém a marca estática se a consulta de acessibilidade falhar', async () => {
    h.consultar.mockRejectedValue(new Error('indisponível'));
    await montar();
    expect(h.iniciar).not.toHaveBeenCalled();
  });
});
