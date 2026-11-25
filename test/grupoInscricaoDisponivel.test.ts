import { describe, expect, it } from "vitest";
import { grupoAbertoParaInscricao } from "../lib/grupoInscricaoDisponivel";

describe("disponibilidade individual de inscrição", () => {
  it("não libera um grupo fechado porque outro grupo está aberto", () => {
    expect(grupoAbertoParaInscricao({ aberta: true, grupos: [{ id: "aberto" }] }, "fechado")).toBe(false);
  });
  it("libera somente o grupo devolvido pelo backend", () => {
    expect(grupoAbertoParaInscricao({ aberta: true, grupos: [{ id: "aberto" }] }, "aberto")).toBe(true);
  });
  it("não libera durante falha ou fechamento da temporada", () => {
    for (const estado of [{ aberta: false }, { aberta: true, falhou: true }]) {
      expect(grupoAbertoParaInscricao({ ...estado, grupos: [{ id: "aberto" }] }, "aberto")).toBe(false);
    }
  });
});
