import React, { useEffect } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({ slug: 'quarta-com-deus', navigate: vi.fn() }));
vi.mock('react-native', () => ({ ActivityIndicator: 'Spinner', Alert: { alert: vi.fn() }, Pressable: 'Pressable', View: 'View', StyleSheet: { create: (s: unknown) => s } }));
vi.mock('@/components/navigation/DockContent', () => ({ ScrollView: 'ScrollView' }));
vi.mock('@/components/ui/Typography', () => ({ Text: 'Text' }));
vi.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
vi.mock('expo-router', () => ({ Stack: { Screen: 'Screen' }, router: { navigate: m.navigate }, useLocalSearchParams: () => ({ planoId: 'plano-teste' }) }));
vi.mock('@react-navigation/native', () => ({ useFocusEffect: (cb: () => void) => useEffect(cb, [cb]) }));
vi.mock('@expo/vector-icons', () => ({ Ionicons: 'Icon' }));
vi.mock('expo-haptics', () => ({}));
vi.mock('@/contexts/ThemeContext', () => ({ useColors: () => ({ primary: '#006655' }) }));
vi.mock('@/lib/i18n', () => ({ useT: () => (s: string) => s }));
vi.mock('@/lib/useMembro', () => ({ useMembro: () => ({ membro: { membroId: 'membro-teste' } }) }));
vi.mock('@/components/ui/Dialogo', () => ({ useDialogo: () => ({ Dialogo: 'Dialogo' }) }));
vi.mock('@/components/ui/ErrorState', () => ({ ErrorState: 'ErrorState' }));
vi.mock('@/lib/hierarquia', () => ({ subirUmNivel: vi.fn() }));
vi.mock('@/lib/telemetria', () => ({ trackEvento: vi.fn() }));
vi.mock('@/lib/devocional', () => ({
  hojeISO: () => '2026-11-26', inscreverNoPlano: vi.fn(),
  planoPorId: async () => ({ id: 'plano-teste', slug: m.slug, titulo: 'Sofonias' }),
  leiturasDoPlano: async () => ['dia-1'],
  itensDoPlano: async () => Array.from({ length: 7 }, (_, i) => ({
    id: `dia-${i + 1}`, ordem_no_ciclo: i + 1,
    data: i < 5 ? `2026-11-${26 + i}` : `2026-12-0${i - 4}`,
    titulo: `Leitura ${i + 1}`, edicao_slug: 'sofonias', edicao_titulo: 'Sofonias',
  })),
}));
import PlanoScreen from '../app/(app)/(principal)/devocional-plano';

let tree: ReactTestRenderer | undefined;
beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  vi.stubGlobal('React', React); vi.clearAllMocks(); m.slug = 'quarta-com-deus';
});
afterEach(async () => { if (tree) await act(async () => tree!.unmount()); tree = undefined; vi.unstubAllGlobals(); });
async function montar() { await act(async () => { tree = create(React.createElement(PlanoScreen)); }); }
function leitura(n: number) {
  const titulo = tree!.root.findAllByType('Text' as any).find(x => x.props.children === `Leitura ${n}`)!;
  let parent = titulo.parent!;
  while (parent.type !== ('Pressable' as any)) parent = parent.parent!;
  return parent;
}
it('mostra as sete leituras juntas, sem abas, e abre o último dia futuro', async () => {
  await montar();
  expect(tree!.root.findAllByProps({ accessibilityRole: 'tab' })).toHaveLength(0);
  for (let n = 1; n <= 7; n++) expect(leitura(n).props.disabled).toBe(false);
  await act(async () => leitura(7).props.onPress());
  expect(m.navigate).toHaveBeenCalledWith(expect.objectContaining({
    pathname: '/devocional-plano-dia', params: expect.objectContaining({ itemId: 'dia-7', numero: '7', total: '7' }),
  }));
  expect(tree!.root.findAllByProps({ name: 'checkmark' })).toHaveLength(1);
});
it('outro plano de calendário mantém a trava de data', async () => {
  m.slug = 'outro-plano'; await montar();
  expect(leitura(1).props.disabled).toBe(false);
  expect(leitura(7).props.disabled).toBe(true);
  await act(async () => leitura(7).props.onPress());
  expect(m.navigate).not.toHaveBeenCalled();
});
