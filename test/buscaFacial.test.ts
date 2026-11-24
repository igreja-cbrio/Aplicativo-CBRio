// BUSCA POR SELFIE NO ÁLBUM DO BATISMO · réguas puras (24/11/2026).
// O que se trava aqui: os limiares medidos (0,45 / 0,55) e a sequência ±2; que
// mensagem da página é aceita (nada de lixo, id de fora, distância inválida);
// o que vai para a página; quando o "Tentar de novo" vale; e que todo texto da
// busca tem tradução (o portão de i18n não enxerga `t(CONSTANTE)`).
// Sem rede: `apiPost` é falso.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { semComentarios } from "../scripts/semComentarios.mjs";

const mock = vi.hoisted(() => ({ apiGet: vi.fn(), apiPost: vi.fn() }));
vi.mock("../lib/api", () => ({ apiGet: mock.apiGet, apiPost: mock.apiPost }));

import { BASE_API, PREFIXO_MINIATURA, registrarConsentimentoBusca } from "../lib/batismoFotos";
import {
  CODIGOS_ERRO,
  LIMIAR_FORTE,
  LIMIAR_PROVAVEL,
  PAGINA_BUSCA_FACIAL,
  PREFIXO_URL_BUSCA,
  SCRIPT_PARAR,
  TEXTOS_CONSENTIMENTO,
  VERSAO_CONSENTIMENTO,
  VIZINHANCA_SEQUENCIA,
  acaoDoErro,
  buscaDisponivel,
  classificar,
  corpoDoConsentimento,
  dataUrlDaSelfie,
  erroDaLista,
  erroDoConsentimento,
  estimativaMb,
  faixa,
  fotosParaBusca,
  idiomaDoConsentimento,
  lerMensagem,
  mensagemDoErro,
  navegacaoPermitida,
  origemDaMensagemPermitida,
  STATUS_RETENTAVEL,
  pendentes,
  podeComecar,
  resumirBusca,
  scriptIniciar,
  situacaoDaBusca,
} from "../lib/buscaFacial";
import { TRANSLATIONS } from "../lib/translations";

const ALBUM = "0b6f1c1e-2a3b-4c5d-8e9f-0a1b2c3d4e5f";
const TOKEN = "eyJ1IjoiYSJ9.AbC-123_xyz";
const URL_OK = `${PREFIXO_URL_BUSCA}${TOKEN}`;
const ids = (n: number) => Array.from({ length: n }, (_, i) => `f${i}`);
const mapa = (pares: [string, number | null][]) => new Map<string, number | null>(pares);

beforeEach(() => {
  mock.apiPost.mockReset();
});

describe("limiares (medidos na página: mesma pessoa 0,152; pessoas diferentes 0,515 e 0,596)", () => {
  it("são 0,45 e 0,55, com sequência ±2", () => {
    expect(LIMIAR_FORTE).toBe(0.45);
    expect(LIMIAR_PROVAVEL).toBe(0.55);
    expect(VIZINHANCA_SEQUENCIA).toBe(2);
  });

  it("faixa: limites exatos (o limiar já pertence à faixa de baixo)", () => {
    expect(faixa(0.152)).toBe("forte");
    expect(faixa(0.4499)).toBe("forte");
    expect(faixa(0.45)).toBe("provavel");
    expect(faixa(0.5499)).toBe("provavel");
    expect(faixa(0.55)).toBe("nenhuma");
    // As duas pessoas DIFERENTES da medição não podem virar "suas".
    expect(faixa(0.515)).toBe("provavel");
    expect(faixa(0.596)).toBe("nenhuma");
  });

  it("faixa: sem rosto, negativo, NaN e infinito não são match", () => {
    expect(faixa(null)).toBe("nenhuma");
    expect(faixa(undefined)).toBe("nenhuma");
    expect(faixa(-0.1)).toBe("nenhuma");
    expect(faixa(Number.NaN)).toBe("nenhuma");
    expect(faixa(Number.POSITIVE_INFINITY)).toBe("nenhuma");
  });
});

describe("classificar", () => {
  it("limites exatos: 0,4499 é sua, 0,45 e 0,5499 são pouca certeza, 0,55 fica de fora", () => {
    // Fotos espaçadas (> 2 posições) para a sequência não interferir.
    const ordem = ids(16);
    const r = classificar(
      mapa([
        ["f0", 0.4499],
        ["f5", 0.45],
        ["f10", 0.5499],
        ["f15", 0.55],
      ]),
      ordem,
    );
    expect(r.suas).toEqual(["f0"]);
    expect(r.talvez).toEqual(["f1", "f2", "f5", "f10"]);
    expect(r.pelaSequencia).toEqual(["f1", "f2"]);
  });

  it("sequência: até 2 posições de uma foto sua entra em pouca certeza; a 3 não", () => {
    const ordem = ids(11);
    const r = classificar(mapa([["f5", 0.2], ["f0", 0.9], ["f10", null]]), ordem);
    expect(r.suas).toEqual(["f5"]);
    expect(r.talvez).toEqual(["f3", "f4", "f6", "f7"]);
    expect(r.pelaSequencia).toEqual(["f3", "f4", "f6", "f7"]);
    expect(r.talvez).not.toContain("f2");
    expect(r.talvez).not.toContain("f8");
  });

  it("vizinha sem rosto, longe ou sem resultado (falhou) entra pela sequência; vizinha 'provável' não conta como sequência", () => {
    const r = classificar(mapa([["a", null], ["b", 0.1], ["c", 0.5], ["e", 0.99]]), ["a", "b", "c", "d", "e"]);
    expect(r.suas).toEqual(["b"]);
    expect(r.talvez).toEqual(["a", "c", "d"]);
    expect(r.pelaSequencia).toEqual(["a", "d"]);
  });

  it("mantém a ordem do álbum, nunca repete e nenhuma foto fica nas duas listas", () => {
    const ordem = ["z", "y", "x", "y", "w", "v", "u"];
    const r = classificar(mapa([["x", 0.1], ["z", 0.3], ["v", 0.5], ["fora", 0.01]]), ordem);
    expect(r.suas).toEqual(["z", "x"]);
    expect(r.talvez).toEqual(["y", "w", "v"]);
    const todas = [...r.suas, ...r.talvez];
    expect(new Set(todas).size).toBe(todas.length);
    expect(todas).not.toContain("fora");
  });

  it("sem nenhuma foto sua, ninguém entra pela sequência", () => {
    const r = classificar(mapa([["a", 0.5], ["b", null], ["c", 0.8]]), ["a", "b", "c"]);
    expect(r).toEqual({ suas: [], talvez: ["a"], pelaSequencia: [] });
  });
});

describe("lerMensagem · tudo o que vem da página é dado não confiável", () => {
  const lote = new Set(["f1", "f2"]);
  const ler = (v: unknown) => lerMensagem(typeof v === "string" ? v : JSON.stringify(v), lote);

  it("lixo, não-texto, texto enorme, array e JSON quebrado viram null", () => {
    expect(lerMensagem(undefined, lote)).toBeNull();
    expect(lerMensagem(42, lote)).toBeNull();
    expect(lerMensagem({ t: "pronto" }, lote)).toBeNull();
    expect(lerMensagem("", lote)).toBeNull();
    expect(lerMensagem("{t:pronto}", lote)).toBeNull();
    expect(lerMensagem("null", lote)).toBeNull();
    expect(lerMensagem('["pronto"]', lote)).toBeNull();
    expect(lerMensagem(JSON.stringify({ t: "pronto", x: "a".repeat(5000) }), lote)).toBeNull();
  });

  it("t desconhecido ou ausente vira null", () => {
    expect(ler({ t: "abrir", url: "https://evil.example" })).toBeNull();
    expect(ler({ t: "PRONTO" })).toBeNull();
    expect(ler({ id: "f1", d: 0.1 })).toBeNull();
  });

  it("sinais simples passam", () => {
    expect(ler({ t: "pronto" })).toEqual({ t: "pronto" });
    expect(ler({ t: "modelos" })).toEqual({ t: "modelos" });
    expect(ler({ t: "selfie" })).toEqual({ t: "selfie" });
  });

  it("foto: id precisa estar no lote enviado; d número finito ≥ 0 ou null", () => {
    expect(ler({ t: "foto", id: "f1", d: 0.3 })).toEqual({ t: "foto", id: "f1", d: 0.3 });
    expect(ler({ t: "foto", id: "f2", d: 0 })).toEqual({ t: "foto", id: "f2", d: 0 });
    expect(ler({ t: "foto", id: "f2", d: null })).toEqual({ t: "foto", id: "f2", d: null });
    expect(ler({ t: "foto", id: "f9", d: 0.1 })).toBeNull();
    expect(ler({ t: "foto", id: "__proto__", d: 0.1 })).toBeNull();
    expect(ler({ t: "foto", id: 1, d: 0.1 })).toBeNull();
    expect(ler({ t: "foto", id: "f1", d: -0.01 })).toBeNull();
    expect(ler({ t: "foto", id: "f1", d: "0.3" })).toBeNull();
    expect(ler({ t: "foto", id: "f1" })).toBeNull();
    expect(ler('{"t":"foto","id":"f1","d":1e999}')).toBeNull();
    expect(ler('{"t":"foto","id":"f1","d":NaN}')).toBeNull();
  });

  it("falha_foto: id do lote e status inteiro de 0 a 599", () => {
    expect(ler({ t: "falha_foto", id: "f1", status: 410 })).toEqual({ t: "falha_foto", id: "f1", status: 410 });
    expect(ler({ t: "falha_foto", id: "f1", status: 0 })).toEqual({ t: "falha_foto", id: "f1", status: 0 });
    expect(ler({ t: "falha_foto", id: "fx", status: 503 })).toBeNull();
    expect(ler({ t: "falha_foto", id: "f1", status: 700 })).toBeNull();
    expect(ler({ t: "falha_foto", id: "f1", status: -1 })).toBeNull();
    expect(ler({ t: "falha_foto", id: "f1", status: 4.5 })).toBeNull();
  });

  it("progresso e fim: contagens inteiras não negativas (feitas ≤ total no progresso)", () => {
    expect(ler({ t: "progresso", feitas: 320, total: 946 })).toEqual({ t: "progresso", feitas: 320, total: 946 });
    expect(ler({ t: "progresso", feitas: 947, total: 946 })).toBeNull();
    expect(ler({ t: "progresso", feitas: "1", total: 2 })).toBeNull();
    expect(ler({ t: "fim", feitas: 40, total: 946, falhas: 2 })).toEqual({ t: "fim", feitas: 40, total: 946, falhas: 2 });
    expect(ler({ t: "fim", feitas: 1, total: 2 })).toBeNull();
  });

  it("erro: código fora da lista vira interno; o texto livre da página é descartado", () => {
    expect(ler({ t: "erro", codigo: "sem_webgl", msg: "<b>oi</b>" })).toEqual({ t: "erro", codigo: "sem_webgl" });
    expect(ler({ t: "erro", codigo: "selfie_varios_rostos" })).toEqual({ t: "erro", codigo: "selfie_varios_rostos" });
    expect(ler({ t: "erro", codigo: "rm -rf" })).toEqual({ t: "erro", codigo: "interno" });
    expect(ler({ t: "erro" })).toEqual({ t: "erro", codigo: "interno" });
  });
});

describe("de onde a mensagem pode vir e o que vai para a página", () => {
  it("só a própria página da busca (ou about:blank)", () => {
    expect(navegacaoPermitida(PAGINA_BUSCA_FACIAL)).toBe(true);
    expect(navegacaoPermitida("https://www.cbrio.org/app-busca-facial")).toBe(true);
    expect(navegacaoPermitida("about:blank")).toBe(true);
    expect(navegacaoPermitida("https://www.cbrio.org/app-busca-facialX/index.html")).toBe(false);
    expect(navegacaoPermitida("https://www.cbrio.org/api/app/batismo/fotos")).toBe(false);
    expect(navegacaoPermitida("http://www.cbrio.org/app-busca-facial/index.html")).toBe(false);
    expect(navegacaoPermitida("https://cbrio.org.evil.example/app-busca-facial/")).toBe(false);
    expect(navegacaoPermitida("https://u:p@www.cbrio.org/app-busca-facial/")).toBe(false);
    expect(navegacaoPermitida(undefined)).toBe(false);
  });

  it("mensagem: a página da busca OU só a origem (o Android entrega só a origem no onMessage)", () => {
    // react-native-webview 13 no Android: addWebMessageListener → url = sourceOrigin ("https://www.cbrio.org").
    // Exigir o caminho aqui descartava toda mensagem e a busca nunca começava no Android.
    expect(origemDaMensagemPermitida("https://www.cbrio.org")).toBe(true);
    expect(origemDaMensagemPermitida("https://www.cbrio.org/")).toBe(true);
    expect(origemDaMensagemPermitida(PAGINA_BUSCA_FACIAL)).toBe(true);
    expect(origemDaMensagemPermitida("https://www.cbrio.org/app-busca-facial/index.html")).toBe(true);
    // about:blank navega, mas não fala com o app
    expect(origemDaMensagemPermitida("about:blank")).toBe(false);
    expect(origemDaMensagemPermitida("http://www.cbrio.org")).toBe(false);
    expect(origemDaMensagemPermitida("https://cbrio.org")).toBe(false);
    expect(origemDaMensagemPermitida("https://www.cbrio.org.evil.example")).toBe(false);
    expect(origemDaMensagemPermitida("https://u:p@www.cbrio.org")).toBe(false);
    expect(origemDaMensagemPermitida("https://www.cbrio.org/api/app/batismo/fotos")).toBe(false);
    expect(origemDaMensagemPermitida("https://www.cbrio.org:8443")).toBe(false);
    expect(origemDaMensagemPermitida(undefined)).toBe(false);
    expect(origemDaMensagemPermitida(null)).toBe(false);
  });

  it("o prefixo de busca é o mesmo caminho de miniatura que o app já valida", () => {
    expect(PREFIXO_URL_BUSCA).toBe(BASE_API + PREFIXO_MINIATURA);
  });

  it("fotosParaBusca: só URL de busca válida, sem repetir id, na ordem do álbum, filtrando por `somente`", () => {
    const fotos = [
      { id: "a", busca: URL_OK },
      { id: "b", busca: null },
      { id: "c", busca: "https://evil.example/x.jpg" },
      { id: "d", busca: `${PREFIXO_URL_BUSCA}../segredo` },
      { id: "a", busca: `${URL_OK}2` },
      { id: "e", busca: `${URL_OK}3` },
    ];
    expect(fotosParaBusca(fotos)).toEqual([
      { id: "a", url: URL_OK },
      { id: "e", url: `${URL_OK}3` },
    ]);
    expect(fotosParaBusca(fotos, new Set(["e", "b"]))).toEqual([{ id: "e", url: `${URL_OK}3` }]);
  });

  it("botão: só com `liberada` do servidor, álbum liberado e foto com URL de busca", () => {
    const fotos = [{ busca: null }, { busca: URL_OK }];
    const liberado = { situacao: "liberado" };
    expect(buscaDisponivel("liberada", liberado, fotos)).toBe(true);
    expect(buscaDisponivel(null, liberado, fotos)).toBe(false);
    expect(buscaDisponivel(undefined, liberado, fotos)).toBe(false);
    expect(buscaDisponivel("menor", liberado, fotos)).toBe(false);
    expect(buscaDisponivel("indisponivel", liberado, fotos)).toBe(false);
    expect(buscaDisponivel("liberada", { situacao: "conflito" }, fotos)).toBe(false);
    expect(buscaDisponivel("liberada", null, fotos)).toBe(false);
    expect(buscaDisponivel("liberada", liberado, [{ busca: null }])).toBe(false);
  });

  it("selfie: base64 vira data URL JPEG; vazio ou com caractere estranho vira null", () => {
    expect(dataUrlDaSelfie("QUJD\nRA==")).toBe("data:image/jpeg;base64,QUJDRA==");
    expect(dataUrlDaSelfie("")).toBeNull();
    expect(dataUrlDaSelfie(undefined)).toBeNull();
    expect(dataUrlDaSelfie('QUJD");alert(1)//')).toBeNull();
  });

  it("scriptIniciar leva exatamente o payload (JSON) e termina em `true;`", () => {
    const fotos = [{ id: "a", url: URL_OK }];
    const s = scriptIniciar("data:image/jpeg;base64,QUJD", fotos);
    expect(s.startsWith("window.__busca && window.__busca.iniciar(")).toBe(true);
    expect(s.endsWith("); true;")).toBe(true);
    const json = s.slice("window.__busca && window.__busca.iniciar(".length, -"); true;".length);
    expect(JSON.parse(json)).toEqual({ selfie: "data:image/jpeg;base64,QUJD", fotos });
    expect(SCRIPT_PARAR).toBe("window.__busca && window.__busca.parar(); true;");
  });

  it("estimativa de dados: ~0,08 MB por foto, arredondada para cima", () => {
    expect(estimativaMb(946)).toBe(76);
    expect(estimativaMb(340)).toBe(28);
    expect(estimativaMb(25)).toBe(2);
    expect(estimativaMb(1)).toBe(1);
    expect(estimativaMb(0)).toBe(0);
    expect(estimativaMb(-3)).toBe(0);
    expect(estimativaMb(Number.NaN)).toBe(0);
  });
});

describe("retomada e Tentar de novo", () => {
  it("pendentes: só o que não tem resultado nem falha (a retomada não repete foto já vista)", () => {
    const res = new Map<string, number | null>([["a", 0.3], ["c", null]]);
    const falhas = new Map([["b", 503]]);
    expect(pendentes(["a", "b", "c", "d", "e"], res, falhas)).toEqual(["d", "e"]);
  });

  it("503, 429, 410 e 0 contam como não verificadas e valem Tentar de novo; 404 não; 410 pede as páginas de novo", () => {
    const ordem = ["a", "b", "c", "d", "e", "f", "g", "h"];
    const comBusca = new Set(["a", "b", "c", "d", "e", "f", "h"]);
    const res = new Map<string, number | null>([["a", 0.2]]);
    const falhas = new Map([
      ["b", 503],
      ["c", 429],
      ["d", 0],
      ["e", 404],
      ["f", 410],
    ]);
    const s = situacaoDaBusca(ordem, comBusca, res, falhas);
    expect(s.verificadas).toBe(1);
    // g não tem URL de busca; h ficou sem resposta: os dois contam como não verificadas.
    expect(s.naoVerificadas).toBe(7);
    expect(s.retentaveis).toEqual(["b", "c", "d", "f", "h"]);
    expect(s.recarregarLista).toBe(true);
    expect(situacaoDaBusca(ordem, comBusca, res, new Map([["b", 503]])).recarregarLista).toBe(false);
  });

  it("5xx passageiro da miniatura (502 do SharePoint, 500/504 da Vercel) vale Tentar de novo; 403 e 404 não", () => {
    for (const st of [500, 502, 504]) expect(STATUS_RETENTAVEL.has(st)).toBe(true);
    for (const st of [400, 401, 403, 404]) expect(STATUS_RETENTAVEL.has(st)).toBe(false);
    const s = situacaoDaBusca(["a", "b", "c"], new Set(["a", "b", "c"]), new Map(), new Map([["a", 502], ["b", 504], ["c", 403]]));
    expect(s.retentaveis).toEqual(["a", "b"]);
  });

  it("resumo: só ids e contagens (nenhuma distância sai da busca)", () => {
    const r = resumirBusca(["a", "b", "c"], new Set(["a", "b", "c"]), new Map([["a", 0.1], ["b", 0.9]]), new Map([["c", 0]]), "pessoa");
    expect(r).toEqual({
      suas: ["a"],
      talvez: ["b", "c"],
      pelaSequencia: ["b", "c"],
      total: 3,
      verificadas: 2,
      naoVerificadas: 1,
      interrompida: true,
      fimDaBusca: "pessoa",
    });
    expect(JSON.stringify(r)).not.toContain("0.1");
  });

  it("resumo: diz se a busca chegou ao fim, se a pessoa parou ou se parou por erro", () => {
    const resumo = (fim: "fim" | "pessoa" | "erro") => resumirBusca(["a"], new Set(["a"]), new Map([["a", 0.1]]), new Map(), fim);
    expect(resumo("fim")).toMatchObject({ interrompida: false, fimDaBusca: "fim" });
    expect(resumo("pessoa")).toMatchObject({ interrompida: true, fimDaBusca: "pessoa" });
    expect(resumo("erro")).toMatchObject({ interrompida: true, fimDaBusca: "erro" });
  });
});

describe("aceite", () => {
  it("as DUAS caixas são obrigatórias", () => {
    expect(podeComecar({ rosto: true, maioridade: true })).toBe(true);
    expect(podeComecar({ rosto: true, maioridade: false })).toBe(false);
    expect(podeComecar({ rosto: false, maioridade: true })).toBe(false);
  });

  it("corpo: versão, maioridade declarada e idioma do app (sem tradução pronta cai em pt)", () => {
    expect(VERSAO_CONSENTIMENTO).toBe("2026-11-24");
    expect(corpoDoConsentimento("pt-BR")).toEqual({ versao: "2026-11-24", declarou_maioridade: true, idioma: "pt" });
    expect(idiomaDoConsentimento("en")).toBe("en");
    expect(idiomaDoConsentimento("es")).toBe("es");
    expect(idiomaDoConsentimento("fr")).toBe("pt");
  });

  it("POST só aceita `{ ok: true }`; id que não é UUID nem chama a rede", async () => {
    mock.apiPost.mockResolvedValueOnce({ ok: true });
    await expect(registrarConsentimentoBusca(ALBUM, "es")).resolves.toBeUndefined();
    expect(mock.apiPost).toHaveBeenCalledWith(`/app/batismo/fotos/${ALBUM}/busca-facial/consentimento`, {
      versao: "2026-11-24",
      declarou_maioridade: true,
      idioma: "es",
    });
    mock.apiPost.mockResolvedValueOnce({});
    await expect(registrarConsentimentoBusca(ALBUM, "pt-BR")).rejects.toThrow();
    mock.apiPost.mockResolvedValueOnce({ ok: "true" });
    await expect(registrarConsentimentoBusca(ALBUM, "pt-BR")).rejects.toThrow();
    mock.apiPost.mockClear();
    await expect(registrarConsentimentoBusca("../x", "pt-BR")).rejects.toMatchObject({ status: 404 });
    expect(mock.apiPost).not.toHaveBeenCalled();
  });

  it("erros do aceite: menor, limite, conflito, sem acesso, sessão; o resto não começa a busca", () => {
    const e = (status: number, codigo?: string) => Object.assign(new Error("x"), { status, corpo: codigo ? { codigo } : null });
    expect(erroDoConsentimento(e(403, "menor"))).toBe("menor");
    expect(erroDoConsentimento(e(429, "limite"))).toBe("limite");
    // 429 sem código é o limitador de 15 minutos da rota, não o limite do dia.
    expect(erroDoConsentimento(e(429))).toBe("consentimento");
    // Busca desligada (kill switch) e texto do aceite mudado: não oferecem "Tentar de novo" sem fim.
    expect(erroDoConsentimento(e(503, "indisponivel"))).toBe("indisponivel");
    expect(erroDoConsentimento(e(400, "versao"))).toBe("versao");
    expect(acaoDoErro("indisponivel")).toBe("nenhuma");
    expect(acaoDoErro("versao")).toBe("nenhuma");
    expect(erroDoConsentimento(e(503))).toBe("consentimento");
    expect(erroDoConsentimento(e(409, "conflito"))).toBe("conflito");
    expect(erroDoConsentimento(e(404, "sem_acesso"))).toBe("sem_acesso");
    expect(erroDoConsentimento(e(401))).toBe("sessao");
    expect(erroDoConsentimento(e(403))).toBe("consentimento");
    expect(erroDoConsentimento(e(500))).toBe("consentimento");
    expect(erroDoConsentimento(new Error("rede"))).toBe("consentimento");
    expect(erroDaLista(e(404))).toBe("sem_acesso");
    expect(erroDaLista(e(409))).toBe("conflito");
    expect(erroDaLista(e(503))).toBe("lista");
  });
});

describe("textos", () => {
  const traduzido = (pt: string) => {
    const tr = TRANSLATIONS[pt];
    return !!tr && !!tr.en && !!tr.es && tr.en !== pt;
  };

  it("o texto do consentimento inteiro está traduzido em en e es", () => {
    expect(TEXTOS_CONSENTIMENTO.length).toBe(7);
    for (const s of TEXTOS_CONSENTIMENTO) expect(traduzido(s), s).toBe(true);
  });

  it("toda mensagem de erro existe e está traduzida", () => {
    for (const c of CODIGOS_ERRO) {
      const msg = mensagemDoErro(c);
      expect(msg.length, c).toBeGreaterThan(10);
      expect(traduzido(msg), msg).toBe(true);
    }
    expect(mensagemDoErro("inventado")).toBe(mensagemDoErro("interno"));
  });

  it("mensagens pedidas pelo produto, palavra por palavra", () => {
    expect(mensagemDoErro("sem_webgl")).toBe("Este celular não consegue rodar a busca. Você ainda pode ver e baixar todas as fotos do álbum.");
    expect(mensagemDoErro("selfie_sem_rosto")).toBe("Não achamos um rosto na selfie. Tente de novo, de frente e com boa luz.");
    expect(mensagemDoErro("selfie_varios_rostos")).toBe("Apareceu mais de um rosto na selfie. Tire de novo só com você.");
  });

  it("o que cada erro oferece", () => {
    expect(acaoDoErro("selfie_sem_rosto")).toBe("selfie");
    expect(acaoDoErro("selfie_varios_rostos")).toBe("selfie");
    expect(acaoDoErro("camera_negada")).toBe("ajustes");
    expect(acaoDoErro("tempo")).toBe("recomecar");
    expect(acaoDoErro("sem_webgl")).toBe("nenhuma");
    expect(acaoDoErro("menor")).toBe("nenhuma");
    expect(acaoDoErro("limite")).toBe("nenhuma");
  });
});

describe("o componente usa as réguas certas", () => {
  const fonte = semComentarios(readFileSync(join(__dirname, "../components/batismo/BuscaFacial.tsx"), "utf8"));

  it("onMessage confere a ORIGEM (o Android não manda o caminho); a navegação confere a página", () => {
    expect(fonte).toContain("origemDaMensagemPermitida(e.nativeEvent.url)");
    expect(fonte).not.toContain("navegacaoPermitida(e.nativeEvent.url)");
    expect(fonte).toContain("onShouldStartLoadWithRequest={(req) => navegacaoPermitida(req.url)}");
  });

  it("limpa as sobras da câmera (abertura do app, abertura e fim da busca) e apaga o arquivo do picker depois de ler a selfie", () => {
    expect(fonte).toContain("limparSobrasDaCamera()");
    expect(fonte).toContain("limparSobrasDaCamera({ idadeMinimaMs: Date.now() - abertaEm })");
    const raiz = semComentarios(readFileSync(join(__dirname, "../app/_layout.tsx"), "utf8"));
    expect(raiz).toContain("useEffect(() => { limparSobrasNaAbertura(); }, []);");
    expect(fonte).toMatch(/FileSystem\.deleteAsync\(asset\.uri, \{ idempotent: true \}\)/);
  });
});
