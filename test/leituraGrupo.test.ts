import { describe, expect, it } from "vitest";
import {
  datasDosDias, diaLiberado, dividirLeitura, maxDias, montarDivisao, normalizarCodigo, proximaLeitura,
  referenciaDoDia, resumoDosLivros, somarDias, totalCapitulos, versiculosDoCapitulo, type DiaLeitura, type LivroEscolhido,
} from "../lib/leituraGrupo";
import { VERSICULOS_POR_CAPITULO } from "../lib/versiculosPorCapitulo";

const SALMOS = 19, ROMANOS = 45, FILIPENSES = 50, COLOSSENSES = 51, OBADIAS = 31;
const livroTodo = (livro: number): LivroEscolhido => ({ livro, cap_inicio: 1, cap_fim: VERSICULOS_POR_CAPITULO[livro - 1].length });
const cobertura = (dias: DiaLeitura[]) => dias.flatMap(d => d.trechos.map(t => `${t.livro}:${t.cap}`));

describe("tabela de versículos", () => {
  it("66 livros, 1.189 capítulos, 31.103 versículos", () => {
    expect(VERSICULOS_POR_CAPITULO).toHaveLength(66);
    expect(VERSICULOS_POR_CAPITULO.reduce((s, l) => s + l.length, 0)).toBe(1189);
    expect(VERSICULOS_POR_CAPITULO.flat().reduce((s, n) => s + n, 0)).toBe(31103);
    expect(versiculosDoCapitulo(SALMOS, 119)).toBe(176);
  });
});

describe("máximo de dias = total de capítulos (capítulos sempre inteiros)", () => {
  it("Filipenses = 4 dias no máximo; com Colossenses, 8", () => {
    expect(maxDias([livroTodo(FILIPENSES)])).toBe(4);
    expect(maxDias([livroTodo(FILIPENSES), livroTodo(COLOSSENSES)])).toBe(8);
    expect(totalCapitulos([{ livro: ROMANOS, cap_inicio: 5, cap_fim: 8 }])).toBe(4);
  });
  it("⚠️ mais dias que capítulos é recusado (a v1 partia capítulo em versículos)", () => {
    expect(() => dividirLeitura([livroTodo(FILIPENSES)], 5)).toThrow();
    expect(() => dividirLeitura([livroTodo(OBADIAS)], 2)).toThrow();
  });
  it("nenhum trecho tem versículos: só capítulos inteiros", () => {
    const d = dividirLeitura([livroTodo(ROMANOS)], 16);
    expect(d.every(x => x.trechos.every(t => t.de === undefined && t.ate === undefined))).toBe(true);
  });
  it("1 dia = tudo num dia; mínimo é 1", () => {
    expect(dividirLeitura([livroTodo(FILIPENSES)], 1)[0].trechos).toHaveLength(4);
    expect(() => dividirLeitura([livroTodo(FILIPENSES)], 0)).toThrow();
  });
});

describe("vários livros, na ordem escolhida", () => {
  it("Salmos 1–3 + Filipenses em 7 dias: 7 capítulos, um por dia, na ordem", () => {
    const d = dividirLeitura([{ livro: SALMOS, cap_inicio: 1, cap_fim: 3 }, livroTodo(FILIPENSES)], 7);
    expect(cobertura(d)).toEqual(["19:1", "19:2", "19:3", "50:1", "50:2", "50:3", "50:4"]);
  });
  it("cobre todos os capítulos uma vez, sem dia vazio", () => {
    const livros = [livroTodo(ROMANOS), livroTodo(FILIPENSES)];
    const d = dividirLeitura(livros, 7);
    expect(d).toHaveLength(7);
    expect(d.every(x => x.trechos.length > 0)).toBe(true);
    expect(cobertura(d)).toEqual([...Array.from({ length: 16 }, (_, i) => `45:${i + 1}`), ...Array.from({ length: 4 }, (_, i) => `50:${i + 1}`)]);
  });
  it("recusa livro ou capítulo inválido", () => {
    expect(() => dividirLeitura([], 1)).toThrow();
    expect(() => dividirLeitura([{ livro: 0, cap_inicio: 1, cap_fim: 1 }], 1)).toThrow();
    expect(() => dividirLeitura([{ livro: ROMANOS, cap_inicio: 10, cap_fim: 5 }], 1)).toThrow();
    expect(() => dividirLeitura([{ livro: ROMANOS, cap_inicio: 1, cap_fim: 17 }], 1)).toThrow();
  });
});

describe("datas: fim de semana opcional", () => {
  // 2026-11-27 = sexta-feira
  it("com fim de semana: dias corridos", () => {
    expect(datasDosDias("2026-11-27", 4, true)).toEqual(["2026-11-27", "2026-11-28", "2026-11-29", "2026-11-30"]);
  });
  it("sem fim de semana: pula sábado e domingo", () => {
    expect(datasDosDias("2026-11-27", 3, false)).toEqual(["2026-11-27", "2026-11-30", "2026-12-01"]);
  });
  it("sem fim de semana e começando num sábado: 1º dia vai pra segunda", () => {
    expect(datasDosDias("2026-11-28", 2, false)).toEqual(["2026-11-30", "2026-12-01"]);
  });
  it("montarDivisao grava a data em cada dia", () => {
    const d = montarDivisao([livroTodo(FILIPENSES)], 4, "2026-11-27", false);
    expect(d.map(x => x.data)).toEqual(["2026-11-27", "2026-11-30", "2026-12-01", "2026-12-02"]);
  });
  it("somarDias atravessa mês e ano", () => {
    expect(somarDias("2026-12-31", 1)).toBe("2027-01-01");
  });
});

describe("sem pacto de data: liberado fica liberado, próxima leitura sem atraso", () => {
  const div = montarDivisao([livroTodo(FILIPENSES)], 4, "2026-11-25", true);
  it("dia liberado continua liberado meses depois; futuro não", () => {
    expect(diaLiberado(div, "2026-11-25", 1, "2027-03-01")).toBe(true);
    expect(diaLiberado(div, "2026-11-25", 2, "2026-11-25")).toBe(false);
  });
  it("próxima leitura = 1º dia liberado não lido, mesmo 3 meses depois", () => {
    expect(proximaLeitura(div, "2026-11-25", [1, 2], "2027-03-01")).toEqual({ dia: 3, liberaEm: null });
  });
  it("leu tudo que liberou: informa quando libera o próximo", () => {
    expect(proximaLeitura(div, "2026-11-25", [1], "2026-11-25")).toEqual({ dia: null, liberaEm: "2026-11-26" });
  });
  it("leu tudo: nada pendente", () => {
    expect(proximaLeitura(div, "2026-11-25", [1, 2, 3, 4], "2027-01-01")).toEqual({ dia: null, liberaEm: null });
  });
  it("leituras v1 sem data usam início + dia − 1", () => {
    const v1: DiaLeitura[] = [{ trechos: [{ cap: 1 }] }, { trechos: [{ cap: 2 }] }];
    expect(diaLiberado(v1, "2026-11-25", 2, "2026-11-26")).toBe(true);
    expect(diaLiberado(v1, "2026-11-25", 2, "2026-11-25")).toBe(false);
  });
});

describe("referência e textos", () => {
  it("referência agrupa capítulos seguidos e separa livros", () => {
    expect(referenciaDoDia({ trechos: [{ livro: ROMANOS, cap: 1 }, { livro: ROMANOS, cap: 2 }, { livro: ROMANOS, cap: 3 }] }, ROMANOS)).toBe("Romanos 1–3");
    expect(referenciaDoDia({ trechos: [{ livro: FILIPENSES, cap: 4 }, { livro: COLOSSENSES, cap: 1 }, { livro: COLOSSENSES, cap: 2 }] }, FILIPENSES)).toBe("Filipenses 4 · Colossenses 1–2");
    expect(referenciaDoDia({ trechos: [{ cap: 8 }] }, ROMANOS)).toBe("Romanos 8");
    expect(referenciaDoDia({ trechos: [{ cap: 119, de: 1, ate: 88 }] }, SALMOS)).toBe("Salmos 119:1–88");
  });
  it("resumo dos livros: livro inteiro só pelo nome", () => {
    expect(resumoDosLivros([livroTodo(FILIPENSES), { livro: SALMOS, cap_inicio: 1, cap_fim: 10 }])).toBe("Filipenses · Salmos 1–10");
  });
  it("normalizarCodigo", () => {
    expect(normalizarCodigo(" ab-c 12x9 ")).toBe("ABC12X");
  });
});
