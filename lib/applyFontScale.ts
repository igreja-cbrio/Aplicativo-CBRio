import { StyleSheet, Text, TextInput, type TextStyle } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { FONT_SCALES, type FontScale } from "@/contexts/ThemeContext";

/**
 * Aplica a escala global de fonte do app multiplicando o fontSize de todo
 * <Text> e <TextInput>. Roda 1 vez no boot do app (em `app/_layout.tsx`).
 *
 * Mudanças posteriores em Configurações exigem reload do app pra
 * reaplicar (o multiplier é capturado no render patched).
 */

const DEFAULT_FONT_SIZE = 14; // default do RN
let multiplier = 1.0;

export async function loadFontScale() {
  try {
    const v = (await AsyncStorage.getItem("cbrio.fontScale")) as FontScale | null;
    if (v && FONT_SCALES[v]) multiplier = FONT_SCALES[v];
  } catch {
    /* ignore */
  }
  if (multiplier !== 1.0) {
    patchComponent(Text);
    patchComponent(TextInput);
  }
}

type Renderable = {
  render?: (...args: unknown[]) => { props?: { style?: unknown } };
  __cbrioPatched?: boolean;
};

function patchComponent(Comp: typeof Text | typeof TextInput) {
  const C = Comp as unknown as Renderable;
  if (C.__cbrioPatched || !C.render) return;
  const original = C.render;
  C.render = function patched(this: unknown, ...args: unknown[]) {
    const el = original.apply(this, args);
    if (!el || !el.props) return el;
    const flat = StyleSheet.flatten(el.props.style as TextStyle | undefined) ?? {};
    const baseSize = typeof flat.fontSize === "number" ? flat.fontSize : DEFAULT_FONT_SIZE;
    const scaled: TextStyle = { ...flat, fontSize: Math.round(baseSize * multiplier) };
    (el.props as { style?: unknown }).style = scaled;
    return el;
  };
  C.__cbrioPatched = true;
}

export function currentFontMultiplier() {
  return multiplier;
}
