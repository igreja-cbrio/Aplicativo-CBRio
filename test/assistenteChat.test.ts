import { describe, expect, it } from "vitest";
import {
  aguardandoResposta,
  maiorCriadoEm,
  mensagemLocal,
  mesclarMensagens,
  proximoIntervalo,
  restaurarConversa,
  serializarConversa,
  type MensagemChat,
} from "@/lib/assistenteChat";

const m = (id: string, autor: MensagemChat["autor"], t: string, corpo = id): MensagemChat => ({
  id, autor, corpo, created_at: `2026-11-10T12:00:${t}Z`,
});

describe("mesclarMensagens", () => {
  it("dedupa por id (o cursor reenvia a linha mais nova)", () => {
    const a = [m("1", "membro", "01"), m("2", "assistente", "02")];
    const r = mesclarMensagens(a, [m("2", "assistente", "02"), m("3", "equipe", "03")]);
    expect(r.mensagens.map((x) => x.id)).toEqual(["1", "2", "3"]);
    expect(r.houveNovidade).toBe(true);
  });
  it("só repetição = sem novidade", () => {
    const a = [m("1", "membro", "01")];
    const r = mesclarMensagens(a, [m("1", "membro", "01")]);
    expect(r.houveNovidade).toBe(false);
    expect(r.mensagens).toHaveLength(1);
  });
  it("dedupa repetição dentro do próprio lote", () => {
    const r = mesclarMensagens([], [m("1", "membro", "01"), m("1", "membro", "01")]);
    expect(r.mensagens).toHaveLength(1);
  });
  it("desde avança pelo maior created_at e nunca recua", () => {
    const r1 = mesclarMensagens([], [m("2", "assistente", "05"), m("1", "membro", "01")]);
    expect(r1.desde).toBe("2026-11-10T12:00:05Z");
    const r2 = mesclarMensagens(r1.mensagens, [], r1.desde);
    expect(r2.desde).toBe("2026-11-10T12:00:05Z");
    expect(mesclarMensagens([], [], "2026-11-10T12:00:09Z").desde).toBe("2026-11-10T12:00:09Z");
  });
  it("ordena por created_at", () => {
    const r = mesclarMensagens([m("3", "equipe", "09")], [m("1", "membro", "01")]);
    expect(r.mensagens.map((x) => x.id)).toEqual(["1", "3"]);
  });
  it("mensagem otimista do membro some quando o servidor confirma", () => {
    const loc = mensagemLocal(1, "membro", "oi", "2026-11-10T12:00:00Z");
    const r = mesclarMensagens([loc], [{ ...m("9", "membro", "01", "oi") }]);
    expect(r.mensagens.map((x) => x.id)).toEqual(["9"]);
    expect(r.desde).toBe("2026-11-10T12:00:01Z");
  });
  it("local não entra no cursor", () => {
    const loc = mensagemLocal(1, "membro", "oi", "2030-01-01T00:00:00Z");
    expect(maiorCriadoEm([loc])).toBeNull();
  });
});

describe("aguardandoResposta / proximoIntervalo", () => {
  it("digitando enquanto a última é do membro ou enviando", () => {
    expect(aguardandoResposta([m("1", "membro", "01")], false)).toBe(true);
    expect(aguardandoResposta([m("1", "assistente", "01")], false)).toBe(false);
    expect(aguardandoResposta([], true)).toBe(true);
  });
  it("intervalo espaça sem novidade e tem teto", () => {
    expect(proximoIntervalo(0, true)).toBeLessThan(proximoIntervalo(0, false) + 1);
    expect(proximoIntervalo(0, false)).toBeLessThan(proximoIntervalo(3, false));
    expect(proximoIntervalo(999, false)).toBe(20000);
  });
});

describe("conversa guardada", () => {
  it("ida e volta", () => {
    const c = { conversa_id: "abc", escalado: true };
    expect(restaurarConversa(serializarConversa(c))).toEqual(c);
  });
  it("lixo ou vazio vira null", () => {
    expect(restaurarConversa(null)).toBeNull();
    expect(restaurarConversa("{")).toBeNull();
    expect(restaurarConversa('{"conversa_id":1}')).toBeNull();
  });
  it("restaurar + histórico completo (desde nulo) preenche a lista", () => {
    const r = mesclarMensagens([], [m("1", "membro", "01"), m("2", "equipe", "05")], null);
    expect(r.mensagens).toHaveLength(2);
    expect(r.desde).toBe("2026-11-10T12:00:05Z");
  });
});

describe("anexo + client_id no merge", () => {
  it("foto otimista (corpo vazio) é trocada pela do servidor com o mesmo client_id", () => {
    const loc = mensagemLocal(1, "membro", "", "2026-11-10T12:00:00Z", { client_id: "X", anexo_url: "file:///a.jpg" });
    expect(loc.client_id).toBe("X");
    expect(loc.anexo_url).toBe("file:///a.jpg");
    const srv = { ...m("9", "membro", "01", ""), client_id: "X", anexo_url: "https://s/a.jpg", anexo_mime: "image/jpeg" };
    const r = mesclarMensagens([loc], [srv]);
    expect(r.mensagens.map((x) => x.id)).toEqual(["9"]);
  });
  it("duas fotos sem texto com client_ids diferentes não colidem", () => {
    const a = mensagemLocal(1, "membro", "", "2026-11-10T12:00:00Z", { client_id: "A" });
    const b = mensagemLocal(2, "membro", "", "2026-11-10T12:00:01Z", { client_id: "B" });
    const r = mesclarMensagens([a, b], [{ ...m("9", "membro", "02", ""), client_id: "B" }]);
    expect(r.mensagens.map((x) => x.id)).toEqual(["local-membro-1", "9"]);
  });
  it("texto puro sem client_id segue casando por corpo", () => {
    const loc = mensagemLocal(1, "membro", "oi", "2026-11-10T12:00:00Z");
    const r = mesclarMensagens([loc], [m("9", "membro", "01", "oi")]);
    expect(r.mensagens.map((x) => x.id)).toEqual(["9"]);
  });
});
