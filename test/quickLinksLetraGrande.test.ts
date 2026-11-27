import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, expect, it, vi } from 'vitest';

// Relato de 27/11/2026: celulares com a letra do sistema aumentada viam só 3
// atalhos (Servir e Generosidade escondidos numa faixa rolável).
const m = vi.hoisted(() => ({ width: 390, fontScale: 1, native: null as unknown }));
vi.mock('react-native', () => ({ View: 'View', Pressable: 'Pressable', StyleSheet: { create: (s: unknown) => s, hairlineWidth: 1 }, useWindowDimensions: () => ({ width: m.width, fontScale: m.fontScale }) }));
vi.mock('@/contexts/TutorialContext', () => ({ useTutorial: () => ({ highlightedTarget: null }), TutorialTarget: 'Target' }));
vi.mock('@/lib/i18n', () => ({ useT: () => (s: string) => s }));
vi.mock('expo-router', () => ({ usePathname: () => '/' }));
vi.mock('@/lib/nav', () => ({ irParaBarra: vi.fn() }));
vi.mock('@/modules/native-shortcuts/src/NativeShortcuts', () => ({ get NativeShortcuts() { return m.native; } }));
vi.mock('@/components/ui/Typography', () => ({ Text: 'Text' }));
vi.mock('@/components/ui/Icone', () => ({ Icone: 'Icone' }));
vi.mock('@/components/navigation/DockSurface', () => ({ DockSurface: 'Surface' }));
import { QuickLinks } from '../components/navigation/QuickLinks';

let tree: ReactTestRenderer;
afterEach(async () => { await act(async () => tree?.unmount()); m.width = 390; m.fontScale = 1; m.native = null; });
async function montar() {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  await act(async () => { tree = create(React.createElement(QuickLinks)); });
}

it('mostra os 5 atalhos com a letra do sistema no máximo, sem rolagem', async () => {
  for (const [width, fontScale] of [[390, 2], [320, 1], [320, 3.1]]) {
    m.width = width; m.fontScale = fontScale;
    await montar();
    expect(tree.root.findAllByType('ScrollView' as any)).toHaveLength(0);
    const botoes = tree.root.findAllByType('Pressable' as any);
    expect(botoes.map((b) => b.props.accessibilityLabel)).toEqual(['Cuidados', 'Devocional', 'Grupos', 'Servir', 'Generosidade']);
    await act(async () => tree.unmount());
  }
});

it('legenda de tamanho fixo: a letra do sistema não a amplia', async () => {
  m.fontScale = 2;
  await montar();
  for (const legenda of tree.root.findAllByType('Text' as any)) {
    expect(legenda.props.allowFontScaling).toBe(false);
    expect(legenda.props.adjustsFontSizeToFit).toBe(true);
  }
});

it('iPhone com a barra nativa continua nela mesmo com letra grande', async () => {
  m.native = 'NativeDock'; m.fontScale = 2;
  await montar();
  expect(tree.root.findAllByType('NativeDock' as any)).toHaveLength(1);
  expect(tree.root.findAllByType('Pressable' as any)).toHaveLength(0);
});
