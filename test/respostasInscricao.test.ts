import { describe, expect, it } from "vitest";
import { rotuloResposta, valorResposta, respostasParaExibir } from "../lib/respostasInscricao";

const CAMPOS = [
  { key: "area_serve", label: "Em qual ministério você serve?" },
  { key: "c_camisa", label: "Tamanho da camisa" },
];

describe("rotuloResposta", () => {
  it("⚠️ usa o rótulo do formulário — a chave técnica não vai pra tela", () => {
    expect(rotuloResposta("area_serve", CAMPOS)).toBe("Em qual ministério você serve?");
  });

  it("pergunta que saiu do formulário vira texto humano, nunca a chave crua", () => {
    expect(rotuloResposta("area_serve", [])).toBe("Area serve");
    expect(rotuloResposta("tamanho_camisa", null)).toBe("Tamanho camisa");
  });

  it("label vazio no campo cai no humanizado", () => {
    expect(rotuloResposta("area_serve", [{ key: "area_serve", label: "   " }])).toBe("Area serve");
  });
});

describe("valorResposta", () => {
  it("múltipla escolha vira lista legível", () => {
    expect(valorResposta(["AMI", "Kids"])).toBe("AMI, Kids");
  });
  it("booleano vira Sim/Não", () => {
    expect(valorResposta(true)).toBe("Sim");
    expect(valorResposta(false)).toBe("Não");
  });
  it("objeto não vira JSON na tela", () => {
    expect(valorResposta({ a: 1 })).toBe("");
  });
  it("vazio e nulo não viram texto", () => {
    expect(valorResposta(null)).toBe("");
    expect(valorResposta("  ")).toBe("");
  });
});

describe("respostasParaExibir", () => {
  it("resposta em branco não vira linha vazia", () => {
    const r = respostasParaExibir({ area_serve: "AMI", c_camisa: "" }, CAMPOS);
    expect(r.map((x) => x.rotulo)).toEqual(["Em qual ministério você serve?"]);
  });

  it("⚠️ segue a ORDEM do formulário, não a do objeto", () => {
    const r = respostasParaExibir({ c_camisa: "M", area_serve: "AMI" }, CAMPOS);
    expect(r.map((x) => x.chave)).toEqual(["area_serve", "c_camisa"]);
  });

  it("resposta sem campo conhecido aparece depois, mas APARECE", () => {
    const r = respostasParaExibir({ extra: "x", area_serve: "AMI" }, CAMPOS);
    expect(r.map((x) => x.chave)).toEqual(["area_serve", "extra"]);
    expect(r[1].rotulo).toBe("Extra");
  });

  it("sem respostas devolve lista vazia", () => {
    expect(respostasParaExibir(null, CAMPOS)).toEqual([]);
  });
});
