import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const native = vi.hoisted(() => ({ width: 393, height: 852, fontScale: 1 }));
vi.mock("react-native", () => ({
  Platform: { OS: "ios", Version: "26.2" },
  useWindowDimensions: () => native,
}));
// The production bridge uses optional require(), so inject the native host at
// that boundary without loading Expo or UIKit in the Node test runner.
vi.mock("../modules/native-shortcuts/src/nativeShortcutsHost", () => ({ NativeShortcutsHost: "native-shortcuts" }));
import { NativeShortcuts } from "../modules/native-shortcuts/src/NativeShortcuts";

const labels = ["Cuidados", "Devocional", "Grupos", "Servir", "Generosidade"];
let tree: ReactTestRenderer;
let paint: Map<number, FrameRequestCallback>;
let nextFrame: number;
function host() { return tree.root.findByType("native-shortcuts" as never); }
async function layout(width = native.width, height = 74) {
  await act(async () => host().props.onLayout({ nativeEvent: { layout: { x: 0, y: 0, width, height } } }));
}
async function flushPaint() {
  const pending = [...paint.values()]; paint.clear();
  await act(async () => pending.forEach(callback => callback(0)));
}
beforeEach(() => {
  native.width = 393; native.height = 852; native.fontScale = 1;
  paint = new Map(); nextFrame = 0;
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => { paint.set(++nextFrame, callback); return nextFrame; });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => paint.delete(id));
});
afterEach(async () => { if (tree) await act(async () => tree.unmount()); vi.unstubAllGlobals(); });

describe("native dock layout lifecycle", () => {
  it("waits for nonzero bounds and a native layout frame before assigning titles", async () => {
    await act(async () => { tree = create(React.createElement(NativeShortcuts!, { labels, selectedIndex: -1, onShortcutSelect: vi.fn() })); });
    expect(host().props.labels).toEqual([]);
    await layout(0); await flushPaint();
    expect(host().props.labels).toEqual([]);
    await layout();
    expect(host().props.labels).toEqual([]);
    await flushPaint();
    expect(host().props.labels).toEqual(labels);
  });

  it("keeps route selection and events without remounting the laid-out control", async () => {
    const onShortcutSelect = vi.fn();
    await act(async () => { tree = create(React.createElement(NativeShortcuts!, { labels, selectedIndex: -1, onShortcutSelect })); });
    await layout(); await flushPaint();
    await act(async () => tree.update(React.createElement(NativeShortcuts!, { labels, selectedIndex: 3, onShortcutSelect })));
    expect(host().props.labels).toEqual(labels);
    expect(host().props.selectedIndex).toBe(3);
    host().props.onShortcutSelect({ nativeEvent: { index: 4 } });
    expect(onShortcutSelect).toHaveBeenCalledWith({ nativeEvent: { index: 4 } });
    expect(paint.size).toBe(0);
  });

  it("re-measures on rotation instead of retaining the old truncated title layout", async () => {
    const props = { labels, selectedIndex: 2, onShortcutSelect: vi.fn() };
    await act(async () => { tree = create(React.createElement(NativeShortcuts!, props)); });
    await layout(); await flushPaint();
    native.width = 852; native.height = 393;
    await act(async () => tree.update(React.createElement(NativeShortcuts!, props)));
    expect(host().props.labels).toEqual([]);
    await layout(720); await flushPaint();
    expect(host().props.labels).toEqual(labels);
    expect(host().props.selectedIndex).toBe(2);
  });

  it("cancels pending layout work when the dock disappears", async () => {
    await act(async () => { tree = create(React.createElement(NativeShortcuts!, { labels, selectedIndex: -1, onShortcutSelect: vi.fn() })); });
    await layout();
    expect(paint.size).toBe(1);
    await act(async () => tree.unmount());
    expect(paint.size).toBe(0);
  });
});
