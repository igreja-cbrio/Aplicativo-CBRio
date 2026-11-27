import { afterEach, describe, expect, it, vi } from "vitest";
import { TETO_FONTE, currentFontMultiplier, escalaEfetiva, scaleTypography, setAppFontScale, subscribeFontScale, tetoDoSistema } from "../lib/fontScale";
afterEach(() => setAppFontScale("md"));
describe("preferência de fonte ao vivo", () => {
  it("notifica textos montados e volta ao padrão sem reiniciar", () => {
    const listener = vi.fn(); const unsubscribe = subscribeFontScale(listener);
    setAppFontScale("xl"); expect(currentFontMultiplier()).toBe(1.28); expect(listener).toHaveBeenCalledTimes(1);
    setAppFontScale("xl"); expect(listener).toHaveBeenCalledTimes(1);
    setAppFontScale("md"); expect(currentFontMultiplier()).toBe(1); expect(listener).toHaveBeenCalledTimes(2);
    unsubscribe(); setAppFontScale("sm"); expect(listener).toHaveBeenCalledTimes(2);
  });
  it("escala entrelinha junto com o texto, sem cortar ou acumular multiplicação", () => {
    const original = { fontSize: 20, lineHeight: 24, letterSpacing: 1, color: "white" };
    expect(scaleTypography(original, 1.28)).toEqual({ fontSize: 26, lineHeight: 31, letterSpacing: 1.28, color: "white" });
    expect(scaleTypography(original, 1)).toEqual(original);
    expect(original.fontSize).toBe(20);
  });
});

// Relato de 27/11/2026: com a letra do celular no máximo a barra caía para 3
// itens e o texto deformava. O teto vale para a soma app × sistema.
describe("teto da letra (TETO_FONTE)", () => {
  it("nenhuma combinação de app e sistema passa de 1,3×", () => {
    for (const app of [0.92, 1, 1.12, 1.28]) for (const sistema of [0.85, 1, 1.3, 1.5, 2, 3.1]) {
      expect(escalaEfetiva(sistema, app)).toBeLessThanOrEqual(TETO_FONTE + 1e-9);
    }
  });
  it("o maxFontSizeMultiplier nunca fica abaixo de 1 (o React Native ignoraria)", () => {
    expect(tetoDoSistema(1)).toBeCloseTo(1.3);
    expect(tetoDoSistema(1.28)).toBeGreaterThanOrEqual(1);
    expect(tetoDoSistema(0.92)).toBeCloseTo(1.3 / 0.92);
  });
  it("letra normal e letra pequena do sistema passam intactas", () => {
    expect(escalaEfetiva(1, 1)).toBe(1);
    expect(escalaEfetiva(0.85, 1)).toBe(0.85);
    expect(escalaEfetiva(1.2, 1)).toBeCloseTo(1.2);
  });
});
