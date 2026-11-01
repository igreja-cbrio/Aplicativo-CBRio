import { beforeEach, describe, expect, it, vi } from "vitest";
const http = vi.hoisted(() => ({ apiGet: vi.fn(), apiPost: vi.fn() }));
vi.mock("../lib/api", () => http);
import {
  carregarTransferencias,
  obterCartaPdf,
  solicitarTransferencia,
  nomeIgrejaValido,
  pedidoAberto,
  type PedidoTransferencia,
} from "../lib/cartaTransferencia";
beforeEach(() => vi.clearAllMocks());
describe("pedido de carta de transferência", () => {
  it("envia só igreja; identidade vem da sessão no servidor", async () => {
    await solicitarTransferencia("  Igreja  Esperança ");
    expect(http.apiPost).toHaveBeenCalledWith("/app/carta-transferencia", {
      igreja_destino: "Igreja Esperança",
    });
  });
  it("não pede id de pessoa para consultar seu histórico", async () => {
    await carregarTransferencias();
    expect(http.apiGet).toHaveBeenCalledWith("/app/carta-transferencia");
  });
  it("falha de envio chega à tela, sem falso sucesso", async () => {
    http.apiPost.mockRejectedValueOnce(new Error("Sem conexão"));
    await expect(solicitarTransferencia("Igreja")).rejects.toThrow(
      "Sem conexão",
    );
  });
  it("considera abertos tanto atendimento quanto integração; histórico final não bloqueia novo pedido", () => {
    const p = (status: PedidoTransferencia["status"]) => ({
      id: status,
      status,
      igreja_destino: "Igreja",
      created_at: "",
    });
    expect(pedidoAberto([p("finalizada"), p("cancelada")])).toBeUndefined();
    expect(
      pedidoAberto([p("finalizada"), p("aguardando_integracao")])?.status,
    ).toBe("aguardando_integracao");
    expect(pedidoAberto([p("em_cuidados")])?.status).toBe("em_cuidados");
  });
  it("valida nome e limite antes de oferecer envio", () => {
    for (const s of ["", " ", "a", "a".repeat(161), "a\0b"])
      expect(nomeIgrejaValido(s)).toBe(false);
    expect(nomeIgrejaValido("  Igreja Esperança  ")).toBe(true);
  });
});

it("PDF usa API autenticada por pedido e rejeita URL fora do bucket privado", async () => {
  http.apiGet.mockResolvedValueOnce({
    url: "https://hhntwfawfnxvuobhdfkb.supabase.co/storage/v1/object/sign/cartas-transferencia/id/file.pdf?token=abc",
  });
  await obterCartaPdf("id");
  expect(http.apiGet).toHaveBeenCalledWith("/app/carta-transferencia/id/pdf");
  for (const url of [
    "http://hhntwfawfnxvuobhdfkb.supabase.co/storage/v1/object/sign/cartas-transferencia/a",
    "https://malicioso.test/carta.pdf",
    "https://hhntwfawfnxvuobhdfkb.supabase.co/storage/v1/object/public/cartas-transferencia/a",
    "",
  ]) {
    http.apiGet.mockResolvedValueOnce({ url });
    await expect(obterCartaPdf("id")).rejects.toThrow(
      "Não foi possível abrir a carta",
    );
  }
});
