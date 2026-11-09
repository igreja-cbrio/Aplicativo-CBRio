// Disponibilidade declarada na aba Servir (09/11/2026) · lib/disponibilidadeSemanas.ts
// O que vale é o servidor; aqui garantimos que a tela lê e monta a escolha certo.
import { describe, expect, it } from "vitest";
import { alternar, normalizarCultos, normalizarCultosOpcoes, normalizarSemanas } from "@/lib/disponibilidadeSemanas";

describe("normalizarSemanas", () => {
  it("aceita várias e a 5ª, em ordem e sem repetir", () => {
    expect(normalizarSemanas([3, 1, 5, 3])).toEqual([1, 3, 5]);
  });
  it("cai na coluna antiga (1 valor) quando a lista vem vazia", () => {
    expect(normalizarSemanas(null, 2)).toEqual([2]);
    expect(normalizarSemanas([], "4")).toEqual([4]);
  });
  it("a lista nova vence a antiga", () => {
    expect(normalizarSemanas([1, 3], 2)).toEqual([1, 3]);
  });
  it("lixo vira lista vazia (= disponível sempre)", () => {
    expect(normalizarSemanas([0, 6, "x", null], 9)).toEqual([]);
    expect(normalizarSemanas(undefined)).toEqual([]);
  });
});

describe("alternar", () => {
  it("liga e mantém em ordem", () => {
    expect(alternar([3], 1)).toEqual([1, 3]);
  });
  it("desliga", () => {
    expect(alternar([1, 3], 3)).toEqual([1]);
  });
  it("ids de culto como texto", () => {
    expect(alternar(["a"], "b")).toEqual(["a", "b"]);
  });
});

describe("cultos", () => {
  it("normaliza ids", () => {
    expect(normalizarCultos(["a", "a", null, ""])).toEqual(["a"]);
    expect(normalizarCultos("a")).toEqual([]);
  });
  it("catálogo ausente = null (servidor sem a migration esconde os cultos)", () => {
    expect(normalizarCultosOpcoes(undefined)).toBeNull();
    expect(normalizarCultosOpcoes(null)).toBeNull();
  });
  it("catálogo presente", () => {
    expect(normalizarCultosOpcoes([{ id: 1, name: "Domingo 9h", recurrence_day: 0, recurrence_time: "09:00:00" }, { name: "sem id" }]))
      .toEqual([{ id: "1", name: "Domingo 9h", recurrence_day: 0, recurrence_time: "09:00:00" }]);
  });
});
