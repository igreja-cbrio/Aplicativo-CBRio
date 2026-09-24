// Régua do plano POR INSCRIÇÃO (Valores de Cristo · 24/09/2026): o dia N só
// abre depois do N-1 lido. Sem isso a tela deixaria ler o dia 5 antes do 1 —
// ou, pior, travaria todo mundo no dia 1 pra sempre.
import { describe, it, expect } from "vitest";
import { ordenarItensDoPlano, diasDoPlano, progressoDoPlano, podeAbrirDia } from "../lib/planoRitmo";

const item = (id: string, ordem: number | null, data = "2000-01-01") => ({ id, ordem_no_ciclo: ordem, data });
const VALORES = [item("e", 5, "2000-01-05"), item("c", 3, "2000-01-03"), item("a", 1, "2000-01-01"), item("d", 4, "2000-01-04"), item("b", 2, "2000-01-02")];

describe("planoRitmo · ordem", () => {
  it("ordena por ordem_no_ciclo, não pela ordem do array", () => {
    expect(ordenarItensDoPlano(VALORES).map((i) => i.id)).toEqual(["a", "b", "c", "d", "e"]);
  });
  it("nulo vai pro fim e a data desempata", () => {
    const r = ordenarItensDoPlano([item("x", null, "2000-01-09"), item("y", null, "2000-01-02"), item("z", 1)]);
    expect(r.map((i) => i.id)).toEqual(["z", "y", "x"]);
  });
  it("não mexe no array de entrada", () => {
    const copia = [...VALORES];
    ordenarItensDoPlano(VALORES);
    expect(VALORES).toEqual(copia);
  });
});

describe("planoRitmo · dias", () => {
  it("sem nada lido, só o dia 1 é atual e o resto fica bloqueado", () => {
    const d = diasDoPlano(VALORES, []);
    expect(d.map((x) => x.estado)).toEqual(["atual", "bloqueado", "bloqueado", "bloqueado", "bloqueado"]);
    expect(d.map((x) => x.numero)).toEqual([1, 2, 3, 4, 5]);
  });
  it("lido o dia 1, o 2 vira atual — nunca dois atuais", () => {
    const d = diasDoPlano(VALORES, ["a"]);
    expect(d.map((x) => x.estado)).toEqual(["lido", "atual", "bloqueado", "bloqueado", "bloqueado"]);
    expect(d.filter((x) => x.estado === "atual")).toHaveLength(1);
  });
  it("lido fora de ordem continua lido; o atual é o primeiro buraco", () => {
    const d = diasDoPlano(VALORES, ["a", "c"]);
    expect(d.map((x) => x.estado)).toEqual(["lido", "atual", "lido", "bloqueado", "bloqueado"]);
  });
  it("tudo lido não tem atual nem bloqueado", () => {
    const d = diasDoPlano(VALORES, ["a", "b", "c", "d", "e"]);
    expect(d.every((x) => x.estado === "lido")).toBe(true);
  });
  it("id que não é do plano não conta", () => {
    const d = diasDoPlano(VALORES, ["zzz"]);
    expect(d[0].estado).toBe("atual");
  });
});

describe("planoRitmo · progresso e abertura", () => {
  it("conta lidos sobre o total", () => {
    expect(progressoDoPlano(diasDoPlano(VALORES, ["a", "b"]))).toEqual({ lidos: 2, total: 5, concluido: false });
  });
  it("concluído só com tudo lido", () => {
    expect(progressoDoPlano(diasDoPlano(VALORES, ["a", "b", "c", "d", "e"])).concluido).toBe(true);
  });
  it("plano vazio nunca é concluído", () => {
    expect(progressoDoPlano([])).toEqual({ lidos: 0, total: 0, concluido: false });
  });
  it("abre lido e atual; bloqueado não", () => {
    expect(podeAbrirDia("lido")).toBe(true);
    expect(podeAbrirDia("atual")).toBe(true);
    expect(podeAbrirDia("bloqueado")).toBe(false);
  });
});
