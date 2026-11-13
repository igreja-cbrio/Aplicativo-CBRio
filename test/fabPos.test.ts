import { describe, it, expect } from "vitest";
import { lerFabPos, limitesFab, posParaPx, pxParaPos, FAB_PADRAO_ACIMA } from "../lib/fabPos";

const lim = limitesFab({ width: 400, height: 800, tamanho: 56, margem: 16, insetTop: 50, insetBottom: 34, bottomOffset: 100 });

describe("fabPos", () => {
  it("JSON inválido ou fora do formato cai no padrão (null)", () => {
    for (const r of [null, undefined, "", "{", "null", "[]", '{"ladoDireito":1,"yFrac":0.5}', '{"ladoDireito":true,"yFrac":"a"}', '{"ladoDireito":true}']) {
      expect(lerFabPos(r)).toBeNull();
    }
  });
  it("yFrac é limitado a 0..1", () => {
    expect(lerFabPos('{"ladoDireito":false,"yFrac":9}')).toEqual({ ladoDireito: false, yFrac: 1 });
  });
  it("padrão: borda direita, 96px acima do limite inferior", () => {
    const p = posParaPx(null, lim);
    expect(p.x).toBe(lim.xDir);
    expect(p.y).toBeCloseTo(lim.maxY - FAB_PADRAO_ACIMA);
  });
  it("clamp: tela menor mantém dentro dos limites", () => {
    const pequeno = limitesFab({ width: 300, height: 400, tamanho: 56, margem: 16, insetTop: 50, insetBottom: 34, bottomOffset: 100 });
    const p = posParaPx({ ladoDireito: true, yFrac: 1 }, pequeno);
    expect(p.y).toBeLessThanOrEqual(pequeno.maxY);
    expect(p.y).toBeGreaterThanOrEqual(pequeno.minY);
  });
  it("ida e volta px ↔ fração", () => {
    const pos = pxParaPos(lim.xEsq, 300, lim, 56);
    expect(pos.ladoDireito).toBe(false);
    expect(posParaPx(pos, lim).y).toBeCloseTo(300);
  });
});
