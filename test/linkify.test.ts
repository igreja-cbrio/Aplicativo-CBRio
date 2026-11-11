import { describe, it, expect } from "vitest";
import { linkify } from "../lib/linkify";

describe("linkify", () => {
  it("URL no meio da frase", () => {
    expect(linkify("Veja https://cbrio.com.br/next para saber mais")).toEqual([
      { tipo: "texto", texto: "Veja " },
      { tipo: "link", texto: "https://cbrio.com.br/next", url: "https://cbrio.com.br/next" },
      { tipo: "texto", texto: " para saber mais" },
    ]);
  });
  it("URL no fim com ponto ou parêntese final", () => {
    expect(linkify("Acesse https://a.com/x.")).toEqual([
      { tipo: "texto", texto: "Acesse " },
      { tipo: "link", texto: "https://a.com/x", url: "https://a.com/x" },
      { tipo: "texto", texto: "." },
    ]);
    expect(linkify("(veja http://a.com/y)")).toEqual([
      { tipo: "texto", texto: "(veja " },
      { tipo: "link", texto: "http://a.com/y", url: "http://a.com/y" },
      { tipo: "texto", texto: ")" },
    ]);
  });
  it("várias URLs", () => {
    const r = linkify("https://a.com e https://b.com/c, ok");
    expect(r.filter((t) => t.tipo === "link").map((t) => t.texto)).toEqual(["https://a.com", "https://b.com/c"]);
    expect(r[r.length - 1]).toEqual({ tipo: "texto", texto: ", ok" });
  });
  it("sem URL", () => {
    expect(linkify("Oi, tudo bem?")).toEqual([{ tipo: "texto", texto: "Oi, tudo bem?" }]);
    expect(linkify("")).toEqual([]);
  });
});
