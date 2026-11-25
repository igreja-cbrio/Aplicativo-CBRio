import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({
  finish: vi.fn(), highlight: vi.fn(), route: '/', cadastro: true, menu: false, push: true,
  targets: { current: new Map() }, appListener: null as null | ((state: string) => void), back: null as null | (() => boolean),
}));
vi.mock('react-native', () => ({
  View: 'View', Pressable: 'Pressable', ScrollView: 'ScrollView',
  StyleSheet: { create: (s: unknown) => s, absoluteFill: {} },
  useWindowDimensions: () => ({ width: 390, height: 844, fontScale: 1 }),
  findNodeHandle: () => 1,
  AccessibilityInfo: { isReduceMotionEnabled: async () => true, addEventListener: () => ({ remove() {} }), setAccessibilityFocus: vi.fn() },
  AppState: { currentState: 'active', addEventListener: (_: string, callback: typeof state.appListener) => { state.appListener = callback; return { remove() {} }; } },
  BackHandler: { addEventListener: (_: string, callback: typeof state.back) => { state.back = callback; return { remove() {} }; } },
  Animated: { View: 'AnimatedView', Value: class { setValue() {} interpolate() { return 0; } }, timing: () => ({ start() {}, stop() {} }) },
}));
vi.mock('@react-navigation/native', () => ({ useIsFocused: () => true }));
vi.mock('expo-router', () => ({ usePathname: () => state.route }));
vi.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 44, bottom: 34, left: 0, right: 0 }) }));
vi.mock('react-native-svg', () => ({ default: 'Svg', Path: 'Path' }));
vi.mock('@expo/vector-icons', () => ({ Ionicons: 'Icon' }));
vi.mock('@/components/ui/Typography', () => ({ Text: 'Text' }));
vi.mock('@/contexts/TutorialContext', () => ({ useTutorial: () => ({ ready: true, pending: true, pushReady: state.push, revision: 0, highlight: state.highlight, finish: state.finish, targets: state.targets }) }));
vi.mock('@/components/auth/CadastroGate', () => ({ useCadastroReady: () => state.cadastro }));
vi.mock('@/contexts/MenuContext', () => ({ useMenu: () => ({ visible: state.menu }) }));
vi.mock('@/contexts/ThemeContext', () => ({ useTheme: () => ({ mode: 'light', fontMultiplier: 1 }) }));
vi.mock('@/lib/i18n', () => ({ useT: () => (s: string) => s }));
import { HomeTutorial } from '../components/onboarding/HomeTutorial';
let tree: ReactTestRenderer;
beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks(); state.route = '/'; state.cadastro = true; state.menu = false; state.push = true;
  vi.stubGlobal('requestAnimationFrame', (fn: () => void) => { fn(); return 1; });
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
});
afterEach(async () => { if (tree) await act(async () => tree.unmount()); vi.unstubAllGlobals(); });
async function mount() { await act(async () => { tree = create(React.createElement(HomeTutorial, null, React.createElement('Home'))); }); }
function text() { return JSON.stringify(tree.toJSON()); }
async function press(label: string) {
  const button = tree.root.findAllByType('Pressable' as any).find(node => node.findAllByType('Text' as any).some(text => text.props.children === label) || node.props.accessibilityLabel === label);
  expect(button).toBeTruthy();
  await act(async () => button!.props.onPress());
}
it('convite, seis passos manuais e concluir; voltar preserva o fluxo', async () => {
  await mount(); expect(text()).toContain('Sua igreja, mais perto.');
  await press('Conhecer o app'); expect(state.highlight).toHaveBeenLastCalledWith('care'); expect(text()).toContain('Você não está sozinho.');
  await press('Próximo'); expect(state.highlight).toHaveBeenLastCalledWith('devotional'); expect(text()).toContain('Um tempo com Deus.');
  await press('Voltar'); expect(text()).toContain('Você não está sozinho.');
  for (let i = 0; i < 5; i++) await press('Próximo');
  expect(text()).toContain('Tem mais para descobrir.');
  expect(state.finish).not.toHaveBeenCalled();
  await press('Concluir'); expect(state.finish).toHaveBeenCalledTimes(1);
});
it('pular e back do Android dispensam sem executar ações da Home', async () => {
  await mount(); await press('Pular'); expect(state.finish).toHaveBeenCalledTimes(1);
  expect(state.back?.()).toBe(true); expect(state.finish).toHaveBeenCalledTimes(2);
});
it('não aparece em deep link nem disputa cadastro ou permissão push', async () => {
  state.route = '/batismo'; await mount(); expect(text()).not.toContain('Sua igreja');
  state.route = '/'; state.cadastro = false;
  await act(async () => tree.update(React.createElement(HomeTutorial))); expect(text()).not.toContain('Sua igreja');
  state.cadastro = true; state.push = false;
  await act(async () => tree.update(React.createElement(HomeTutorial))); expect(text()).not.toContain('Sua igreja');
});
it('background interrompe overlay sem marcar conclusão', async () => {
  await mount(); await act(async () => state.appListener?.('background'));
  expect(text()).not.toContain('Sua igreja'); expect(state.finish).not.toHaveBeenCalled(); expect(state.highlight).toHaveBeenLastCalledWith(null);
});
