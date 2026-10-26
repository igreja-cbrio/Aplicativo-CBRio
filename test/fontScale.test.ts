import { afterEach, describe, expect, it, vi } from "vitest";
import { currentFontMultiplier, scaleTypography, setAppFontScale, subscribeFontScale } from "../lib/fontScale";
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
