import { afterEach, describe, expect, it } from "vitest";
import { JANELA_MS, esquecerPosicaoBiblia, guardarPosicaoBiblia, posicaoBibliaRecente } from "../lib/bibliaPosicao";

// Relógio passado por parâmetro: o teste não depende da hora da máquina.
const T0 = 1_800_000_000_000;
const galatas = { livro: "Gálatas", numero: 3, versao: "almeida", y: 840, em: T0 };
afterEach(() => esquecerPosicaoBiblia());

describe("onde a pessoa parou na Bíblia", () => {
  it("sem leitura nesta sessão, abre na lista de livros", () => {
    expect(posicaoBibliaRecente(T0)).toBeNull();
  });
  it("saída rápida reabre no mesmo capítulo, versão e rolagem", () => {
    guardarPosicaoBiblia(galatas);
    expect(posicaoBibliaRecente(T0 + 60_000)).toEqual(galatas);
    expect(posicaoBibliaRecente(T0 + JANELA_MS)).toEqual(galatas);
  });
  it("passada a janela, volta a abrir na lista (decisão de 25/11)", () => {
    guardarPosicaoBiblia(galatas);
    expect(posicaoBibliaRecente(T0 + JANELA_MS + 1)).toBeNull();
  });
  it("relógio que andou para trás não reabre posição inventada", () => {
    guardarPosicaoBiblia(galatas);
    expect(posicaoBibliaRecente(T0 - 1)).toBeNull();
  });
});
