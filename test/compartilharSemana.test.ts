// Compartilhar a semana inteira do Quarta com Deus (27/11/2026) e a régua de
// "só a edição que está valendo".
import { describe, it, expect } from "vitest";
import { mensagemDaSemana, urlDaSemana, BASE_DA_SEMANA } from "../lib/compartilharSemana";
import { edicaoVigente } from "../lib/planoRitmo";

describe("compartilharSemana · link e texto", () => {
  it("o link aponta para a página pública da EDIÇÃO, com www", () => {
    expect(BASE_DA_SEMANA).toBe("https://www.cbrio.org/quarta-com-deus");
    expect(urlDaSemana("2026-12-02-habacuque")).toBe("https://www.cbrio.org/quarta-com-deus/2026-12-02-habacuque");
  });
  it("edição sem slug de verdade não tem página (agrupada por semana, vazia, com lixo)", () => {
    for (const chave of ["semana:2026-11-23", "", null, undefined, "Habacuque", "a b", "../x", "a--b", "x".repeat(91)]) {
      expect(urlDaSemana(chave as string)).toBeNull();
      expect(mensagemDaSemana({ chave: chave as string, titulo: "X" })).toBeNull();
    }
  });
  it("a mensagem diz o que é, de quando é, e termina no link", () => {
    const m = mensagemDaSemana({ chave: "2026-12-02-habacuque", titulo: "Habacuque", inicio: "2026-11-26", fim: "2026-12-02" });
    expect(m).toBe("Quarta com Deus: Habacuque (26/11 a 02/12)\nAs 7 leituras da semana, uma por dia até o culto de quarta:\nhttps://www.cbrio.org/quarta-com-deus/2026-12-02-habacuque");
  });
  it("sem título ou sem datas, a frase não fica com buraco", () => {
    expect(mensagemDaSemana({ chave: "2026-12-02-habacuque" })!.split("\n")[0]).toBe("Quarta com Deus");
    expect(mensagemDaSemana({ chave: "2026-12-02-habacuque", titulo: " Habacuque " })!.split("\n")[0]).toBe("Quarta com Deus: Habacuque");
  });
  it("o texto passa pela tradução; o nome do plano e o link não", () => {
    const m = mensagemDaSemana({ chave: "2026-12-02-habacuque", titulo: "Habacuque", inicio: "2026-11-26", fim: "2026-12-02" }, (s) => `[${s}]`)!;
    expect(m).toContain("Quarta com Deus: Habacuque (26/11 [a] 02/12)");
    expect(m).toContain("[As 7 leituras da semana, uma por dia até o culto de quarta]:");
    expect(m.endsWith("https://www.cbrio.org/quarta-com-deus/2026-12-02-habacuque")).toBe(true);
  });
});

describe("planoRitmo · só a edição que está valendo", () => {
  // Da mais nova para a mais antiga, como `edicoesDoCalendario` devolve.
  const EDS = [
    { chave: "futura", inicio: "2026-12-03", fim: "2026-12-09" },
    { chave: "atual", inicio: "2026-11-26", fim: "2026-12-02" },
    { chave: "passada", inicio: "2026-11-19", fim: "2026-11-25" },
  ];
  it("a semana adiantada pelo autor NÃO aparece antes da quinta-feira dela", () => {
    expect(edicaoVigente(EDS, "2026-11-27").map((e) => e.chave)).toEqual(["atual"]);
    expect(edicaoVigente(EDS, "2026-12-02").map((e) => e.chave)).toEqual(["atual"]);
  });
  it("na quinta a nova entra e a anterior sai sozinha", () => {
    expect(edicaoVigente(EDS, "2026-12-03").map((e) => e.chave)).toEqual(["futura"]);
  });
  it("sem edição nova, a última continua (não some no dia seguinte ao culto)", () => {
    expect(edicaoVigente(EDS.slice(1), "2026-12-05").map((e) => e.chave)).toEqual(["atual"]);
  });
  it("nenhuma começou ainda: mostra a primeira que vem, em vez de tela vazia", () => {
    expect(edicaoVigente(EDS, "2026-11-01").map((e) => e.chave)).toEqual(["passada"]);
  });
  it("lista vazia continua vazia", () => {
    expect(edicaoVigente([], "2026-11-27")).toEqual([]);
  });
});
