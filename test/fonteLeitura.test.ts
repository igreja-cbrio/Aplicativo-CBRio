// Tamanho de letra das telas de leitura (24/09/2026). A guarda que importa é a
// das PONTAS: sem clamp, o passo passa do último índice e `PASSOS_FONTE[n]` vira
// undefined ⇒ fontSize NaN ⇒ texto some da tela.
import { describe, it, expect } from "vitest";
import { PASSOS_FONTE, PASSO_PADRAO, normalizarPasso, mudarPasso, escalar } from "../lib/fonteLeitura";

describe("fonteLeitura", () => {
  it("o padrão é o passo 1 (multiplicador 1.0)", () => {
    expect(PASSOS_FONTE[PASSO_PADRAO]).toBe(1);
  });
  it("aumenta e diminui um passo por vez", () => {
    expect(mudarPasso(1, 1)).toBe(2);
    expect(mudarPasso(2, -1)).toBe(1);
  });
  it("trava nas pontas — não dá volta nem estoura o array", () => {
    expect(mudarPasso(PASSOS_FONTE.length - 1, 1)).toBe(PASSOS_FONTE.length - 1);
    expect(mudarPasso(0, -1)).toBe(0);
  });
  it("valor guardado lixo cai no padrão", () => {
    for (const v of ["abc", "9", "-1", "1.5", null, undefined, {}, NaN]) expect(normalizarPasso(v)).toBe(PASSO_PADRAO);
    expect(normalizarPasso("3")).toBe(3);
    expect(normalizarPasso(0)).toBe(0);
  });
  it("escala fontSize E lineHeight juntos, arredondados", () => {
    expect(escalar({ fontSize: 19, lineHeight: 32 }, 1)).toEqual({ fontSize: 19, lineHeight: 32 });
    expect(escalar({ fontSize: 19, lineHeight: 32 }, 4)).toEqual({ fontSize: 29, lineHeight: 48 });
    expect(escalar({ fontSize: 15, lineHeight: 23 }, 0)).toEqual({ fontSize: 13, lineHeight: 20 });
  });
  it("passo inválido na escala não produz NaN", () => {
    const r = escalar({ fontSize: 19, lineHeight: 32 }, 99);
    expect(Number.isFinite(r.fontSize) && Number.isFinite(r.lineHeight)).toBe(true);
  });
});
