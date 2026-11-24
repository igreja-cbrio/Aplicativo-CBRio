// Fonte do texto da Bíblia (24/11/2026): o bible-api.com tirou todas as
// traduções em português; português vem do getBible. Ver lib/bibliaLivre.ts.
import { describe, expect, it } from "vitest";
import { LIVROS_BIBLIA, VERSOES_BIBLIA, urlDoCapitulo, versiculosDaResposta } from "../lib/bibliaLivre";

const livro = (nome: string) => LIVROS_BIBLIA.find((l) => l.nome === nome)!;

describe("versões", () => {
  it("a padrão é em português e vem do getBible", () => {
    expect(VERSOES_BIBLIA[0].idioma).toBe("Português");
    expect(VERSOES_BIBLIA[0].fonte).toBe("getbible");
    expect(VERSOES_BIBLIA.filter((v) => v.idioma === "Português").every((v) => v.fonte === "getbible")).toBe(true);
  });
  it("66 livros na ordem canônica (o getBible numera 1 a 66)", () => {
    expect(LIVROS_BIBLIA).toHaveLength(66);
    expect(LIVROS_BIBLIA[0].nome).toBe("Gênesis");
    expect(LIVROS_BIBLIA[18].nome).toBe("Salmos");
    expect(LIVROS_BIBLIA[42].nome).toBe("João");
    expect(LIVROS_BIBLIA[65].nome).toBe("Apocalipse");
  });
});

describe("endereço do capítulo", () => {
  it("português no getBible, pelo número do livro", () => {
    expect(urlDoCapitulo(livro("João"), 3, "livre")).toBe("https://api.getbible.net/v2/livre/43/3.json");
    expect(urlDoCapitulo(livro("Salmos"), 23, "almeida")).toBe("https://api.getbible.net/v2/almeida/19/23.json");
  });
  it("inglês continua no bible-api.com", () => {
    expect(urlDoCapitulo(livro("João"), 3, "kjv")).toBe("https://bible-api.com/John%203?translation=kjv");
  });
  it("versão desconhecida cai na padrão (nunca no 404 do bible-api)", () => {
    expect(urlDoCapitulo(livro("João"), 3, "xyz")).toBe("https://api.getbible.net/v2/livre/43/3.json");
  });
});

describe("resposta → versículos", () => {
  it("formato do getBible", () => {
    const json = { verses: [{ chapter: 3, verse: 16, text: " Porque Deus amou ao mundo  de tal maneira " }, { verse: 17, text: "" }] };
    expect(versiculosDaResposta(json, livro("João"), 3)).toEqual([
      { book_name: "João", chapter: 3, verse: 16, text: "Porque Deus amou ao mundo de tal maneira" },
    ]);
  });
  it("formato do bible-api", () => {
    const json = { verses: [{ book_name: "John", chapter: 3, verse: 16, text: "For God so loved the world\n" }] };
    expect(versiculosDaResposta(json, livro("João"), 3)).toEqual([{ book_name: "João", chapter: 3, verse: 16, text: "For God so loved the world" }]);
  });
  it("lixo não vira versículo", () => {
    expect(versiculosDaResposta(null, livro("João"), 3)).toEqual([]);
    expect(versiculosDaResposta({ verses: "x" }, livro("João"), 3)).toEqual([]);
  });
});
