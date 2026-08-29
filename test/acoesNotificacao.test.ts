// ⚠️ ESPELHO de src/test/acaoNotificacao.test.ts do ERP: os MESMOS casos, pros
// dois lados decidirem igual. Divergir faz o app oferecer botão que o servidor
// recusa — ou esconder um que funcionaria.
import { describe, it, expect } from "vitest";
import { acoesDaNotificacao, rotuloAcao, rotuloFeito, ehAcaoPrincipal, MAX_ESCALAS } from "../lib/acoesNotificacao";

describe("ações da notificação (espelho do servidor)", () => {
  it("escala COM ids mostra confirmar e pedir troca", () => {
    const r = acoesDaNotificacao("escala", { tipo: "escala", escala_ids: ["a", "b"] });
    expect(r.acoes).toEqual(["confirmar", "nao_posso"]);
    expect(r.escalaIds).toEqual(["a", "b"]);
  });

  it("⚠️⚠️ escala SEM ids não mostra botão (as notificações antigas)", () => {
    expect(acoesDaNotificacao("escala", { tipo: "escala" }).acoes).toEqual([]);
    expect(acoesDaNotificacao("escala", { escala_ids: [] }).acoes).toEqual([]);
    expect(acoesDaNotificacao("escala", null).acoes).toEqual([]);
  });

  it("pedido de grupo COM pedido_id mostra aprovar e recusar", () => {
    const r = acoesDaNotificacao("grupo_pedido", { pedido_id: "p1", grupo_id: "g1" });
    expect(r.acoes).toEqual(["aprovar", "recusar"]);
    expect(r.pedidoId).toBe("p1");
  });

  it("pedido de grupo sem id não mostra botão", () => {
    expect(acoesDaNotificacao("grupo_pedido", { grupo_id: "g1" }).acoes).toEqual([]);
  });

  it("⚠️ já respondida vira desfecho, não botão", () => {
    const r = acoesDaNotificacao("escala", { escala_ids: ["a"], acao: "confirmar" });
    expect(r.acoes).toEqual([]);
    expect(r.feita).toBe("confirmar");
    expect(rotuloFeito("confirmar")).toBe("Presença confirmada");
  });

  it("tipo sem ação não ganha botão", () => {
    expect(acoesDaNotificacao("comunicado", { slug: "x" }).acoes).toEqual([]);
    expect(acoesDaNotificacao("devocional", {}).acoes).toEqual([]);
  });

  it("⚠️ lixo no data não vira alvo", () => {
    expect(acoesDaNotificacao("escala", { escala_ids: "a" }).acoes).toEqual([]);
    expect(acoesDaNotificacao("escala", { escala_ids: [1, null, "  "] }).acoes).toEqual([]);
    expect(acoesDaNotificacao("grupo_pedido", { pedido_id: "  " }).acoes).toEqual([]);
  });

  it("⚠️ teto de escalas e sem repetição", () => {
    const muitos = Array.from({ length: 40 }, (_, i) => `id-${i}`);
    expect(acoesDaNotificacao("escala", { escala_ids: muitos }).escalaIds).toHaveLength(MAX_ESCALAS);
    expect(acoesDaNotificacao("escala", { escala_ids: ["a", "a", "b"] }).escalaIds).toEqual(["a", "b"]);
  });

  it("⚠️ o botão de peso é confirmar/aprovar", () => {
    expect(ehAcaoPrincipal("confirmar")).toBe(true);
    expect(ehAcaoPrincipal("aprovar")).toBe(true);
    expect(ehAcaoPrincipal("nao_posso")).toBe(false);
    expect(ehAcaoPrincipal("recusar")).toBe(false);
  });

  it("rótulos: 'Pedir troca' é o texto de declined", () => {
    expect(rotuloAcao("nao_posso")).toBe("Pedir troca");
    expect(rotuloAcao("confirmar")).toBe("Confirmar presença");
    expect(rotuloAcao("aprovar")).toBe("Aprovar");
  });
});
