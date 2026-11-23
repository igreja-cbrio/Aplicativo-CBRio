import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
const h = vi.hoisted(() => ({
  permission: { status: 'denied', canAskAgain: false },
  listener: null as null | ((s: string) => void),
  stored: new Map<string, string>(),
  confirmar: vi.fn(), register: vi.fn(), settings: vi.fn(), translate: (s: string) => s,
}));
vi.mock('react-native', () => ({ Platform: { OS: 'ios' }, Linking: { openSettings: h.settings }, AppState: { currentState: 'active', addEventListener: (_: string, fn: (s: string) => void) => { h.listener = fn; return { remove() { h.listener = null; } }; } } }));
vi.mock('expo-notifications', () => ({ getPermissionsAsync: async () => h.permission }));
vi.mock('@react-native-async-storage/async-storage', () => ({ default: { getItem: async (k: string) => h.stored.get(k), setItem: async (k: string, v: string) => { h.stored.set(k, v); } } }));
vi.mock('../components/ui/Dialogo', () => ({ useDialogo: () => ({ confirmar: h.confirmar, Dialogo: () => null }) }));
vi.mock('../lib/i18n', () => ({ useT: () => h.translate }));
vi.mock('../lib/push', () => ({ registerForPush: h.register }));
import { ConviteNotificacoes } from '../components/notificacoes/ConviteNotificacoes';
let tree: ReactTestRenderer;
beforeEach(() => { vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true); h.confirmar.mockReset(); h.register.mockReset(); h.settings.mockReset(); h.stored.clear(); });
afterEach(async () => { if (tree) await act(async () => tree.unmount()); vi.unstubAllGlobals(); });
async function montar(userId: string) { await act(async () => { tree = create(React.createElement(ConviteNotificacoes, { userId })); }); }
describe('convite único por instalação e conta', () => {
  it('oferece Configurações para recusas definitivas sem repetir no retorno', async () => {
    h.permission = { status: 'denied', canAskAgain: false }; h.confirmar.mockResolvedValue(true);
    await montar('settings'); expect(h.settings).toHaveBeenCalledOnce(); expect(h.confirmar.mock.calls[0][0].acao).toBe('Abrir Configurações');
    await act(async () => h.listener?.('active')); expect(h.confirmar).toHaveBeenCalledOnce();
  });
  it('Agora não preserva o acesso e não solicita permissão nativa', async () => {
    h.permission = { status: 'undetermined', canAskAgain: true }; h.confirmar.mockResolvedValue(false);
    await montar('cancel'); expect(h.register).not.toHaveBeenCalled();
    await act(async () => tree.unmount()); await montar('cancel'); expect(h.confirmar).toHaveBeenCalledOnce();
  });
  it('novo usuário pode aceitar e autorizar o pedido nativo', async () => {
    h.permission = { status: 'undetermined', canAskAgain: true }; h.confirmar.mockResolvedValue(true);
    await montar('new'); expect(h.register).toHaveBeenCalledWith('new', { solicitarPermissao: true });
  });
  it('quem já autorizou só renova o registro', async () => {
    h.permission = { status: 'granted', canAskAgain: true };
    await montar('allowed'); expect(h.confirmar).not.toHaveBeenCalled(); expect(h.register).toHaveBeenCalledWith('allowed');
  });
});
