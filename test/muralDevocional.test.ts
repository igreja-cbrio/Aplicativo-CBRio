import { describe, expect, it } from "vitest";
import { alternarReacao, lerReferencia, normalizarFiltro, textoDosVersos } from "../lib/muralDevocional";

describe("mural do devocional", () => {
  it("filtro salvo inválido volta para Toda a igreja", () => {
    expect(normalizarFiltro("grupo")).toBe("grupo");
    expect(normalizarFiltro("servir")).toBe("servir");
    expect(normalizarFiltro(null)).toBe("igreja");
    expect(normalizarFiltro("qualquer")).toBe("igreja");
  });

  it("lê a referência gravada pela Bíblia", () => {
    expect(lerReferencia("Tiago 1:5")).toMatchObject({ livro: { nome: "Tiago" }, capitulo: 1, versos: [5] });
    expect(lerReferencia("Tiago 1:5,7")?.versos).toEqual([5, 7]);
    expect(lerReferencia("Salmos 23:1-3")?.versos).toEqual([1, 2, 3]);
    expect(lerReferencia("1 Coríntios 13:4")?.livro.nome).toBe("1 Coríntios");
  });

  it("referência sem versículo ou de livro desconhecido não busca nada", () => {
    expect(lerReferencia("Tiago 1")).toBeNull();
    expect(lerReferencia("Livro Inventado 1:1")).toBeNull();
    expect(lerReferencia("Tiago 99:1")).toBeNull();
    expect(lerReferencia("")).toBeNull();
    expect(lerReferencia(null)).toBeNull();
  });

  it("junta só os versículos citados", () => {
    const vs = [1, 2, 3].map(verse => ({ book_name: "Tiago", chapter: 1, verse, text: ` v${verse} ` }));
    expect(textoDosVersos(vs, [1, 3])).toBe("v1 v3");
  });

  it("reação liga e desliga sem ficar negativa", () => {
    const ligada = alternarReacao({ reacoes: { coracao: 2 }, minhas: [] }, "coracao");
    expect(ligada).toEqual({ reacoes: { coracao: 3 }, minhas: ["coracao"] });
    expect(alternarReacao(ligada, "coracao")).toEqual({ reacoes: { coracao: 2 }, minhas: [] });
    expect(alternarReacao({ reacoes: {}, minhas: ["oracao"] }, "oracao").reacoes.oracao).toBe(0);
  });
});
