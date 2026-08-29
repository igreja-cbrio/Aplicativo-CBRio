import { describe, it, expect } from "vitest";
import { temKidsHoje, rotuloFilhos, codigoValido } from "../lib/kidsHoje";

const HOJE = "2026-08-30";

describe("card do Kids na Home", () => {
  it("aparece quando HOJE tem culto com kids", () => {
    expect(temKidsHoje([{ data: HOJE, has_kids: true }], HOJE)).toBe(true);
  });

  it("⚠️ culto de OUTRO dia não liga o card", () => {
    // A lista da Home vem com 7 dias; sem o corte por data o card ficaria
    // aceso a semana inteira e o pai geraria código de quarta pra domingo.
    expect(temKidsHoje([{ data: "2026-09-06", has_kids: true }], HOJE)).toBe(false);
  });

  it("⚠️⚠️ has_kids nulo ou falso NÃO conta", () => {
    // AMI e Bridge não têm Kids. Tratar null como "tem" mandaria o pai gerar
    // um código que nenhum totem vai ler naquele dia.
    expect(temKidsHoje([{ data: HOJE, has_kids: null }], HOJE)).toBe(false);
    expect(temKidsHoje([{ data: HOJE, has_kids: false }], HOJE)).toBe(false);
    expect(temKidsHoje([{ data: HOJE }], HOJE)).toBe(false);
  });

  it("basta UM culto do dia ter kids", () => {
    expect(temKidsHoje([{ data: HOJE, has_kids: false }, { data: HOJE, has_kids: true }], HOJE)).toBe(true);
  });

  it("lista vazia, nula ou sem hoje não liga nada", () => {
    expect(temKidsHoje([], HOJE)).toBe(false);
    expect(temKidsHoje(null, HOJE)).toBe(false);
    expect(temKidsHoje([{ data: HOJE, has_kids: true }], "")).toBe(false);
  });

  it("rótulo usa o PRIMEIRO nome e junta com 'e'", () => {
    expect(rotuloFilhos(["Laura Souza", "Miguel Souza"])).toBe("Laura e Miguel");
    expect(rotuloFilhos(["Laura Souza"])).toBe("Laura");
  });

  it("⚠️ 3+ filhos não estouram a linha", () => {
    expect(rotuloFilhos(["Laura", "Miguel", "Ana", "Téo"])).toBe("Laura, Miguel +2");
  });

  it("nome vazio/nulo não vira espaço solto", () => {
    expect(rotuloFilhos(["", null, "  ", "Ana"])).toBe("Ana");
    expect(rotuloFilhos([])).toBe("");
  });

  it("⚠️⚠️ código vencido NÃO é mostrado como pronto", () => {
    const agora = Date.parse("2026-08-30T12:00:00Z");
    expect(codigoValido({ codigo: "AB12", expira_em: "2026-08-30T18:00:00Z" }, agora)).toBe(true);
    expect(codigoValido({ codigo: "AB12", expira_em: "2026-08-30T09:00:00Z" }, agora)).toBe(false);
  });

  it("⚠️ sem data legível, trata como vencido (fail-closed)", () => {
    const agora = Date.parse("2026-08-30T12:00:00Z");
    expect(codigoValido({ codigo: "AB12", expira_em: null }, agora)).toBe(false);
    expect(codigoValido({ codigo: "AB12", expira_em: "amanhã" }, agora)).toBe(false);
    expect(codigoValido({ codigo: "", expira_em: "2026-08-30T18:00:00Z" }, agora)).toBe(false);
    expect(codigoValido(null, agora)).toBe(false);
  });
});
