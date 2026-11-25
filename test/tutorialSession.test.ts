import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const m = vi.hoisted(() => ({ user: { id: 'a' }, prepare: vi.fn(), finish: vi.fn() }));
vi.mock('@react-native-async-storage/async-storage', () => ({ default: {} }));
vi.mock('react-native', () => ({ View: 'View' }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: m.user, preview: false }) }));
vi.mock('@/lib/tutorial', () => ({ prepararTutorial: m.prepare, concluirTutorial: m.finish }));
import { TutorialProvider, useTutorial } from '../contexts/TutorialContext';
let value: NonNullable<ReturnType<typeof useTutorial>>;
function Probe() { value = useTutorial()!; return null; }
let tree: ReactTestRenderer;
function scene() { return React.createElement(TutorialProvider, null, React.createElement(Probe)); }
beforeEach(() => { (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true; vi.clearAllMocks(); m.user = { id: 'a' }; m.finish.mockResolvedValue(undefined); });
afterEach(async () => { if (tree) await act(async () => tree.unmount()); });
it('pular/concluir dispensam, replay é explícito e não apaga a marca', async () => {
  m.prepare.mockResolvedValue('pending');
  await act(async () => { tree = create(scene()); });
  expect(value.pending).toBe(true); expect(value.pushReady).toBe(false);
  await act(async () => value.releasePush()); expect(value.pushReady).toBe(true);
  await act(async () => value.finish()); expect(value.pending).toBe(false);
  expect(m.finish).toHaveBeenCalledWith({}, 'a');
  await act(async () => value.replay()); expect(value.pending).toBe(true);
  expect(m.finish).toHaveBeenCalledTimes(1);
});
it('resposta tardia de A não libera nem muda o tutorial de B', async () => {
  let resolveA!: (value: string) => void;
  m.prepare.mockImplementation((_: unknown, id: string) => id === 'a' ? new Promise(resolve => { resolveA = resolve; }) : Promise.resolve('done'));
  await act(async () => { tree = create(scene()); }); expect(value.ready).toBe(false);
  m.user = { id: 'b' }; await act(async () => tree.update(scene()));
  expect(value.pending).toBe(false);
  await act(async () => resolveA('pending'));
  expect(value.pending).toBe(false); expect(value.pushReady).toBe(false);
});
it('pedido manual não se perde se a leitura inicial terminar depois', async () => {
  let resolve!: (value: string) => void;
  m.prepare.mockImplementation(() => new Promise(r => { resolve = r; }));
  await act(async () => { tree = create(scene()); });
  await act(async () => value.replay());
  await act(async () => resolve('done'));
  expect(value.pending).toBe(true); expect(value.ready).toBe(true);
});
