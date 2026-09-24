// Quebra do texto do devocional em parágrafos curtos (24/09/2026). Sem isto a
// reflexão chega num bloco só de 6–7 frases; com a régua errada, "Atos 2.42"
// vira duas frases.
import { describe, it, expect } from "vitest";
import { frases, paragrafos } from "../lib/paragrafos";

const REFLEXAO = "A primeira igreja não nasceu de um evento, nasceu de uma decisão repetida todo dia. Lucas escolhe uma palavra forte: eles perseveravam. Não visitavam a doutrina quando sobrava tempo; ficavam nela. Seguir Jesus começa aí. Na CBRio, o primeiro valor é este. Se eles conseguiram em Jerusalém, dá para conseguir no Rio.";

describe("paragrafos · frases", () => {
  it("corta em ponto/exclamação/interrogação seguidos de maiúscula", () => {
    expect(frases("Um. Dois! Três? Quatro.")).toEqual(["Um.", "Dois!", "Três?", "Quatro."]);
  });
  it("NÃO corta em 'Atos 2.42' nem em 'Pr. Pedrão'", () => {
    expect(frases("Leia Atos 2.42 hoje. O Pr. Pedrão fala disso.")).toEqual(["Leia Atos 2.42 hoje.", "O Pr. Pedrão fala disso."]);
  });
  it("aspa de fechamento fica na frase", () => {
    expect(frases("Ele disse “vem.” Ela foi.")).toEqual(["Ele disse “vem.”", "Ela foi."]);
  });
});

describe("paragrafos · agrupamento", () => {
  it("bloco de 6 frases vira 3 parágrafos de 2", () => {
    const p = paragrafos(REFLEXAO);
    expect(p).toHaveLength(3);
    expect(p[0].startsWith("A primeira igreja")).toBe(true);
    expect(p[2].startsWith("Na CBRio")).toBe(true);
    expect(p.join(" ")).toBe(REFLEXAO);
  });
  it("bloco curto (até 3 frases) fica inteiro", () => {
    expect(paragrafos("Um. Dois. Três.")).toEqual(["Um. Dois. Três."]);
  });
  it("linha em branco do autor sempre separa, e cada bloco é avaliado sozinho", () => {
    expect(paragrafos("Primeiro bloco.\n\nSegundo bloco.")).toEqual(["Primeiro bloco.", "Segundo bloco."]);
  });
  it("vazio e nulo devolvem lista vazia", () => {
    expect(paragrafos("")).toEqual([]);
    expect(paragrafos(null)).toEqual([]);
    expect(paragrafos(undefined)).toEqual([]);
  });
  it("respeita maxFrases", () => {
    expect(paragrafos("A. B. C. D. E. F.", 3)).toEqual(["A. B. C.", "D. E. F."]);
  });
});
