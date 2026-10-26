/** Preferência compartilhada; assinantes atualizam sem remontar as telas. */
export type FontScale = "sm" | "md" | "lg" | "xl";
export const FONT_SCALES: Record<FontScale, number> = { sm: 0.92, md: 1, lg: 1.12, xl: 1.28 };
let multiplier = 1;
const listeners = new Set<() => void>();
export const currentFontMultiplier = () => multiplier;
export function subscribeFontScale(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }
export function setAppFontScale(scale: FontScale) {
  const next = FONT_SCALES[scale];
  if (!next || next === multiplier) return;
  multiplier = next;
  listeners.forEach((listener) => listener());
}
export function scaleTypography<T extends { fontSize?: number; lineHeight?: number; letterSpacing?: number }>(style: T, scale: number): T {
  return { ...style, fontSize: Math.round((style.fontSize ?? 14) * scale),
    ...(style.lineHeight != null ? { lineHeight: Math.round(style.lineHeight * scale) } : {}),
    ...(style.letterSpacing != null ? { letterSpacing: style.letterSpacing * scale } : {}) };
}
