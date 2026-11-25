import { describe, expect, it } from "vitest";
import { LIMITE_TRECHO, resumirTrecho } from "../lib/trechoBiblico";

describe("resumirTrecho", () => {
  it("texto curto sai inteiro, sem corte", () => {
    expect(resumirTrecho("Porque Deus amou o mundo.")).toEqual({ curto: "Porque Deus amou o mundo.", cortado: false });
  });
  it("vazio ou nulo não quebra", () => {
    expect(resumirTrecho(null)).toEqual({ curto: "", cortado: false });
    expect(resumirTrecho("   ")).toEqual({ curto: "", cortado: false });
  });
  it("capítulo inteiro é cortado no limite, no fim de uma palavra, com reticências", () => {
    const capitulo = Array.from({ length: 80 }, (_, i) => `versículo${i} fala de graça,`).join(" ");
    const { curto, cortado } = resumirTrecho(capitulo);
    expect(cortado).toBe(true);
    expect(curto.length).toBeLessThanOrEqual(LIMITE_TRECHO + 1);
    expect(curto.endsWith("…")).toBe(true);
    expect(curto).not.toMatch(/[ ,]…$/);
    expect(capitulo.startsWith(curto.slice(0, -1))).toBe(true);
  });
  it("exatamente no limite não corta", () => {
    expect(resumirTrecho("a".repeat(LIMITE_TRECHO)).cortado).toBe(false);
    expect(resumirTrecho("a".repeat(LIMITE_TRECHO + 1)).cortado).toBe(true);
  });
  it("junta quebras de linha e espaços repetidos", () => {
    expect(resumirTrecho("No princípio\n\n  era o Verbo").curto).toBe("No princípio era o Verbo");
  });
});
