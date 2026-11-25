import { describe, expect, it } from "vitest";
import { diaAtual, diaLiberado, dividirLeitura, normalizarCodigo, referenciaDoDia, somarDias, versiculosDoCapitulo, type DiaLeitura } from "../lib/leituraGrupo";
import { VERSICULOS_POR_CAPITULO } from "../lib/versiculosPorCapitulo";

const ROMANOS = 45, FILIPENSES = 50, SALMOS = 19, OBADIAS = 31;

function versosDoDia(livro: number, dia: DiaLeitura): number {
  return dia.trechos.reduce((s, t) => {
    const ate = t.ate ?? versiculosDoCapitulo(livro, t.cap);
    return s + ate - (t.de ?? 1) + 1;
  }, 0);
}
/** Lista plana de (cap, verso) coberta, na ordem: prova que nada falta nem se repete. */
function cobertura(livro: number, dias: DiaLeitura[]): string[] {
  return dias.flatMap(d => d.trechos.flatMap(t => {
    const ate = t.ate ?? versiculosDoCapitulo(livro, t.cap);
    return Array.from({ length: ate - (t.de ?? 1) + 1 }, (_, i) => `${t.cap}:${(t.de ?? 1) + i}`);
  }));
}
function esperado(livro: number, ini: number, fim: number): string[] {
  const saida: string[] = [];
  for (let c = ini; c <= fim; c++) for (let v = 1; v <= versiculosDoCapitulo(livro, c); v++) saida.push(`${c}:${v}`);
  return saida;
}

describe("tabela de versículos", () => {
  it("66 livros, 1.189 capítulos, 31.103 versículos", () => {
    expect(VERSICULOS_POR_CAPITULO).toHaveLength(66);
    expect(VERSICULOS_POR_CAPITULO.reduce((s, l) => s + l.length, 0)).toBe(1189);
    expect(VERSICULOS_POR_CAPITULO.flat().reduce((s, n) => s + n, 0)).toBe(31103);
    expect(versiculosDoCapitulo(SALMOS, 119)).toBe(176);
  });
});

describe("dividirLeitura · capítulos inteiros", () => {
  it("Romanos (16) em 16 dias = um capítulo por dia", () => {
    const d = dividirLeitura(ROMANOS, 1, 16, 16);
    expect(d.map(x => x.trechos)).toEqual(Array.from({ length: 16 }, (_, i) => [{ cap: i + 1 }]));
  });
  it("Romanos em 5 dias: só capítulos inteiros, contíguos, cobrindo tudo, sem dia vazio", () => {
    const d = dividirLeitura(ROMANOS, 1, 16, 5);
    expect(d).toHaveLength(5);
    expect(d.every(x => x.trechos.length >= 1 && x.trechos.every(t => t.de === undefined))).toBe(true);
    expect(cobertura(ROMANOS, d)).toEqual(esperado(ROMANOS, 1, 16));
  });
  it("dias equilibrados: nenhum dia passa do dobro do ideal quando há capítulos de sobra", () => {
    const d = dividirLeitura(SALMOS, 1, 150, 30);
    const ideal = 2461 / 30;
    for (const x of d) expect(versosDoDia(SALMOS, x)).toBeLessThan(ideal * 2 + 176);
    expect(cobertura(SALMOS, d)).toEqual(esperado(SALMOS, 1, 150));
  });
  it("intervalo de capítulos respeita o começo e o fim", () => {
    const d = dividirLeitura(ROMANOS, 5, 8, 2);
    expect(d[0].trechos[0].cap).toBe(5);
    expect(d[1].trechos[d[1].trechos.length - 1].cap).toBe(8);
  });
  it("1 dia = tudo num dia", () => {
    expect(dividirLeitura(FILIPENSES, 1, 4, 1)).toEqual([{ trechos: [{ cap: 1 }, { cap: 2 }, { cap: 3 }, { cap: 4 }] }]);
  });
});

describe("dividirLeitura · mais dias que capítulos", () => {
  it("Filipenses (4 caps) em 10 dias: 10 blocos, sem buraco nem repetição", () => {
    const d = dividirLeitura(FILIPENSES, 1, 4, 10);
    expect(d).toHaveLength(10);
    expect(cobertura(FILIPENSES, d)).toEqual(esperado(FILIPENSES, 1, 4));
  });
  it("último bloco de cada capítulo vai até o fim (sem `ate`)", () => {
    const d = dividirLeitura(FILIPENSES, 1, 4, 10);
    const ultimos = d.filter((x, i) => i === d.length - 1 || d[i + 1].trechos[0].cap !== x.trechos[0].cap);
    expect(ultimos.every(x => x.trechos[0].ate === undefined)).toBe(true);
  });
  it("Obadias (1 cap, 21 versos) em 21 dias = um versículo por dia", () => {
    const d = dividirLeitura(OBADIAS, 1, 1, 21);
    expect(d.map(x => versosDoDia(OBADIAS, x))).toEqual(Array(21).fill(1));
  });
});

describe("dividirLeitura · entradas inválidas", () => {
  it("recusa livro, capítulos e dias fora da faixa", () => {
    expect(() => dividirLeitura(0, 1, 1, 1)).toThrow();
    expect(() => dividirLeitura(ROMANOS, 0, 16, 5)).toThrow();
    expect(() => dividirLeitura(ROMANOS, 10, 5, 5)).toThrow();
    expect(() => dividirLeitura(ROMANOS, 1, 17, 5)).toThrow();
    expect(() => dividirLeitura(OBADIAS, 1, 1, 22)).toThrow();
    expect(() => dividirLeitura(SALMOS, 1, 150, 366)).toThrow();
    expect(() => dividirLeitura(ROMANOS, 1, 16, 0)).toThrow();
  });
});

describe("referência, datas e código", () => {
  it("referência do dia", () => {
    expect(referenciaDoDia("Romanos", ROMANOS, { trechos: [{ cap: 1 }, { cap: 2 }, { cap: 3 }] })).toBe("Romanos 1–3");
    expect(referenciaDoDia("Romanos", ROMANOS, { trechos: [{ cap: 8 }] })).toBe("Romanos 8");
    expect(referenciaDoDia("Salmos", SALMOS, { trechos: [{ cap: 119, de: 89 }] })).toBe("Salmos 119:89–176");
    expect(referenciaDoDia("Salmos", SALMOS, { trechos: [{ cap: 119, de: 1, ate: 88 }] })).toBe("Salmos 119:1–88");
  });
  it("somarDias atravessa mês e ano", () => {
    expect(somarDias("2026-11-25", 6)).toBe("2026-12-01");
    expect(somarDias("2026-12-31", 1)).toBe("2027-01-01");
  });
  it("diaAtual: antes, durante, depois", () => {
    expect(diaAtual("2026-11-25", 10, "2026-11-24")).toBe(0);
    expect(diaAtual("2026-11-25", 10, "2026-11-25")).toBe(1);
    expect(diaAtual("2026-11-25", 10, "2026-12-04")).toBe(10);
    expect(diaAtual("2026-11-25", 10, "2026-12-05")).toBe(11);
  });
  it("diaLiberado: hoje e passado sim, futuro não", () => {
    expect(diaLiberado(1, "2026-11-25", "2026-11-25")).toBe(true);
    expect(diaLiberado(2, "2026-11-25", "2026-11-25")).toBe(false);
    expect(diaLiberado(2, "2026-11-25", "2026-11-30")).toBe(true);
  });
  it("normalizarCodigo", () => {
    expect(normalizarCodigo(" ab-c 12x9 ")).toBe("ABC12X");
  });
});
