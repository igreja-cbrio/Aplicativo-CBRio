import { describe, expect, it } from "vitest";
import {
  aguardandoResposta,
  maiorCriadoEm,
  maiorSequencia,
  menorSequencia,
  destinoNotificacaoChat,
  mensagemLocal,
  mesclarMensagens,
  limparMensagensTransitorias,
  proximoIntervalo,
  restaurarConversa,
  serializarConversa,
  type MensagemChat,
} from "@/lib/assistenteChat";

const m = (id: string, autor: MensagemChat["autor"], t: string, corpo = id): MensagemChat => ({
  id, autor, corpo, created_at: `2026-11-10T12:00:${t}Z`,
});

describe('paginação para trás', () => {
  it('carrega 450 mensagens sem perder ordem, deduplicar incorretamente ou recuar cursor de polling', () => {
    const todas = Array.from({ length: 450 }, (_, i) => ({ ...m(String(i + 1), 'membro', '01'), sequencia: i + 1 }));
    const recente = todas.slice(250);
    const meio = mesclarMensagens(recente, todas.slice(50, 250)).mensagens;
    const completo = mesclarMensagens(meio, todas.slice(0, 50)).mensagens;
    expect(completo.map(x => x.sequencia)).toEqual(todas.map(x => x.sequencia));
    expect(menorSequencia(recente)).toBe(251);
    expect(menorSequencia(completo)).toBe(1);
    expect(maiorSequencia(completo)).toBe(450);
  });
  it('não usa mensagem otimista ou sequência inválida como cursor anterior', () => {
    expect(menorSequencia([mensagemLocal(1, 'membro', 'oi', '', { sequencia: 1 }),
      { ...m('server', 'membro', '01'), sequencia: 7 }, { ...m('bad', 'membro', '01'), sequencia: -1 }])).toBe(7);
    expect(menorSequencia([])).toBeNull();
  });
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
    const c = { conversa_id: "d7af12a0-62bf-4f50-a45c-49dcb129ff00", escalado: true };
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


describe("cursor de sequência e notificações", () => {
  it("mantém otimistas ao final mesmo com relógios divergentes", () => {
    const a = { ...m("1", "equipe", "09"), sequencia: 1 };
    const b = { ...m("2", "equipe", "01"), sequencia: 2 };
    const local = mensagemLocal(1, "membro", "nova pergunta", "2020-01-01T00:00:00Z");
    for (const lote of [[a, b], [b, a]]) {
      expect(mesclarMensagens([local], lote).mensagens.map(x => x.id)).toEqual(["1", "2", local.id]);
    }
  });
  it("preserva mensagens no mesmo instante e ordena pela sequência do servidor", () => {
    const primeira = { ...m("1", "membro", "01"), sequencia: 1 };
    const segunda = { ...m("2", "equipe", "01"), sequencia: 2 };
    const terceira = { ...m("3", "equipe", "00"), sequencia: 3 };
    const r = mesclarMensagens([primeira], [terceira, segunda, segunda]);
    expect(r.mensagens.map(x => x.id)).toEqual(["1", "2", "3"]);
    expect(maiorSequencia(r.mensagens)).toBe(3);
    expect(maiorSequencia([mensagemLocal(99, "membro", "oi", "2030-01-01")])).toBeNull();
  });
  it("abre a conversa exata do aviso e descarta destinos inválidos", () => {
    const id = "d7af12a0-62bf-4f50-a45c-49dcb129ff00";
    expect(destinoNotificacaoChat({ conversa_id: id })).toEqual({ pathname: "/fale-conosco-chat", params: { conversa_id: id } });
    for (const conversa_id of [undefined, "/outro", [id], 123]) {
      expect(destinoNotificacaoChat({ conversa_id })).toBe("/fale-conosco-chat");
    }
    expect(restaurarConversa('{"conversa_id":"abc"}')).toBeNull();
  });
});


describe("avisos locais transitórios", () => {
  it("limite → novo envio confirmado → equipe remove aviso antigo e preserva otimista vigente", () => {
    const recusada = { ...mensagemLocal(1, "membro", "oi", "2020-01-01"), transitoria: true };
    const aviso = { ...mensagemLocal(2, "assistente", "Aguarde um instante", "2020-01-01"), transitoria: true };
    const nova = mensagemLocal(3, "membro", "preciso de ajuda", "2020-01-01");
    const antes = [recusada, aviso, nova];
    const limpas = limparMensagensTransitorias(antes);
    expect(limpas).toEqual([nova]);
    expect(antes).toHaveLength(3);
    expect(aguardandoResposta(limpas, false)).toBe(true);
    const entrada = { ...m("entrada", "membro", "01", nova.corpo), sequencia: 1 };
    const equipe = { ...m("resposta", "equipe", "02", "Vamos ajudar"), sequencia: 2 };
    const confirmado = mesclarMensagens(limpas, [entrada]).mensagens;
    expect(aguardandoResposta(confirmado, false)).toBe(true);
    const final = mesclarMensagens(confirmado, [equipe]).mensagens;
    expect(final.map(x => x.id)).toEqual(["entrada", "resposta"]);
    expect(aguardandoResposta(final, false)).toBe(false);
  });
  it("não remove mensagem persistida nem otimista sem marca transitória", () => {
    const real = { ...m("servidor", "assistente", "01"), transitoria: true };
    const otimista = mensagemLocal(1, "membro", "oi", "2020-01-01");
    expect(limparMensagensTransitorias([real, otimista])).toEqual([real, otimista]);
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
    expect(r.mensagens.map((x) => x.id)).toEqual(["9", "local-membro-1"]);
  });
  it("texto puro sem client_id segue casando por corpo", () => {
    const loc = mensagemLocal(1, "membro", "oi", "2026-11-10T12:00:00Z");
    const r = mesclarMensagens([loc], [m("9", "membro", "01", "oi")]);
    expect(r.mensagens.map((x) => x.id)).toEqual(["9"]);
  });
});
