import React, { useEffect } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, expect, it, vi } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
const state = vi.hoisted(() => ({ pathname: '/', mounts: 0, unmounts: 0 }));
vi.mock('react-native', () => ({ View: 'View' }));
vi.mock('expo-router', () => ({ usePathname: () => state.pathname }));
vi.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ bottom: 34 }) }));
vi.mock('expo-status-bar', () => ({ StatusBar: 'StatusBar' }));
vi.mock('@/contexts/ThemeContext', () => ({ useTheme: () => ({ colors: { background: '#fff' }, mode: 'light' }) }));
vi.mock('@/components/onboarding/HomeTutorial', () => ({ HomeTutorial: ({ children }: any) => children }));
vi.mock('@/components/navigation/DockContent', async () => ({ DockInsetContext: (await import('react')).createContext(0) }));
vi.mock('@/components/chat/ChatFab', () => ({ ChatFab: 'ChatFab' }));
vi.mock('@/components/ui/BottomBar', () => ({ BottomBar: (props: any) => {
  useEffect(() => { state.mounts++; return () => { state.unmounts++; }; }, []);
  return React.createElement('Dock', props);
} }));
import { AppDockShell } from '../components/navigation/AppDockShell';
let tree: ReactTestRenderer;
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
afterEach(async () => { if (tree) await act(async () => tree.unmount()); });
const shell = (rota: string) => React.createElement(AppDockShell, { rota, children: React.createElement('Screens') });
it('mantém uma única barra sob o chat na abertura, arraste parcial, cancelamento e volta', async () => {
  state.mounts = 0; state.unmounts = 0;
  await act(async () => { tree = create(shell('index')); });
  // O pathname só muda no fim do gesto; a tela de baixo não depende dele.
  for (const pathname of ['/fale-conosco-chat', '/fale-conosco-chat', '/fale-conosco-chat', '/']) {
    state.pathname = pathname;
    await act(async () => tree.update(shell('index')));
    expect(tree.root.findAllByType('Dock' as any)).toHaveLength(1);
    expect(tree.root.findByType('Dock' as any).props.rota).toBe('/');
  }
  expect(state.mounts).toBe(1); expect(state.unmounts).toBe(0);
});
it('mantém seleção e instância da barra em outras telas; cadastro segue sem saída pelo dock', async () => {
  state.mounts = 0; state.unmounts = 0; state.pathname = '/fale-conosco-chat';
  await act(async () => { tree = create(shell('devocional')); });
  expect(tree.root.findByType('Dock' as any).props.rota).toBe('/devocional');
  await act(async () => tree.update(shell('notificacoes')));
  expect(state.mounts).toBe(1);
  for (const rota of ['completar-cadastro', 'inscricao-formulario']) {
    await act(async () => tree.update(shell(rota)));
    expect(tree.root.findAllByType('Dock' as any)).toHaveLength(0);
    expect(tree.root.findAllByType('ChatFab' as any)).toHaveLength(0);
  }
});
it('o chat cobre o Stack com dock, preservando portões compartilhados e Home em deep link', () => {
  const outer = readFileSync('app/(app)/_layout.tsx', 'utf8');
  const inner = readFileSync('app/(app)/(principal)/_layout.tsx', 'utf8');
  expect(outer).toContain('anchor: "(principal)"');
  expect(outer).toContain('<CadastroGate>'); expect(outer).toContain('<MembroProvider>');
  expect(outer).toContain('name="fale-conosco-chat"');
  expect(outer).not.toContain('<BottomBar');
  expect(inner).toContain('state.routes[state.index].name');
  expect(inner).toContain('initialRouteName: "index"');
  expect(existsSync('app/(app)/fale-conosco-chat.tsx')).toBe(true);
  expect(existsSync('app/(app)/(principal)/fale-conosco-chat.tsx')).toBe(false);
});
