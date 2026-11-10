import { describe, expect, it } from "vitest";
import { VALORES, valorDaRota } from "@/lib/valores";

describe("valores da jornada", () => {
  it("tem os 5 valores, na ordem", () => {
    expect(VALORES.map((v) => v.key)).toEqual(["seguir", "conectar", "investir", "servir", "generosidade"]);
    expect(VALORES.map((v) => v.nome)).toEqual(["Seguir a Jesus", "Conectar", "Investir tempo com Deus", "Servir", "Generosidade"]);
  });
  const casos: [string, string][] = [
    ["/batismo", "Seguir a Jesus"], ["/modo-culto", "Seguir a Jesus"], ["/culto-detalhe", "Seguir a Jesus"],
    ["/grupos", "Conectar"], ["/meu-grupo", "Conectar"], ["/grupo-detalhe", "Conectar"],
    ["/devocional", "Investir tempo com Deus"], ["/voluntariado", "Servir"], ["/generosidade", "Generosidade"],
  ];
  it.each(casos)("%s -> %s", (rota, nome) => expect(valorDaRota(rota)?.nome).toBe(nome));
  it("ignora query, hash e barra final", () => {
    expect(valorDaRota("/culto-detalhe?x=1")?.key).toBe("seguir");
    expect(valorDaRota("/grupo-detalhe/?id=2#a")?.key).toBe("conectar");
  });
  it("rota fora dos valores devolve null (e prefixo não casa)", () => {
    for (const r of ["/cuidados", "/menu", "/", "", "/grupos-x", "/devocional-plano"]) expect(valorDaRota(r)).toBeNull();
  });
});
