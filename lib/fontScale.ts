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
/**
 * TETO DA LETRA (27/11/2026 · relato da quarta: "celulares com a letra maior
 * cortavam o menu para 3 e deixavam as letras meio deformadas").
 *
 * O tamanho final na tela era preferência do app (até 1,28×) VEZES a fonte do
 * sistema (até 2× no Android, mais no iPhone): passava de 2,5× e quebrava
 * layout. Decisão do Marcos: o app cresce no máximo 1,3× no total. Bíblia e
 * devocional continuam com o A−/A+ próprio (lib/fonteLeitura), que não passa
 * por aqui.
 */
export const TETO_FONTE = 1.3;

/** `maxFontSizeMultiplier` do React Native: quanto a fonte do SISTEMA ainda pode
 *  ampliar por cima da preferência do app sem passar do teto (o RN exige ≥ 1). */
export function tetoDoSistema(multiplicadorApp: number) {
  return Math.max(1, TETO_FONTE / multiplicadorApp);
}

/** Ampliação que chega de fato à tela (preferência do app × sistema, com o teto).
 *  Layout que decide por "letra grande" usa ESTE número, não o fontScale cru. */
export function escalaEfetiva(fontScaleSistema: number, multiplicadorApp: number) {
  return multiplicadorApp * Math.min(fontScaleSistema, tetoDoSistema(multiplicadorApp));
}

export function scaleTypography<T extends { fontSize?: number; lineHeight?: number; letterSpacing?: number }>(style: T, scale: number): T {
  return { ...style, fontSize: Math.round((style.fontSize ?? 14) * scale),
    ...(style.lineHeight != null ? { lineHeight: Math.round(style.lineHeight * scale) } : {}),
    ...(style.letterSpacing != null ? { letterSpacing: style.letterSpacing * scale } : {}) };
}
