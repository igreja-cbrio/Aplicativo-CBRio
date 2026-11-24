// ÁLBUM DO BATISMO · réguas puras do app (24/11/2026).
// O que se trava aqui: para onde o aviso leva, que URL o app aceita montar
// (miniatura) e seguir (download do SharePoint), e que erro NUNCA vira "sem
// fotos". Sem rede: `apiGet` é falso.
import { beforeEach, describe, expect, it, vi } from "vitest";

const mock = vi.hoisted(() => ({ apiGet: vi.fn(), apiPost: vi.fn() }));
vi.mock("../lib/api", () => ({ apiGet: mock.apiGet, apiPost: mock.apiPost }));

import { destinoNotificacaoBatismo } from "../lib/batismoFotosDestino";
import {
  BASE_API,
  albumInicial,
  classificarErroFotos,
  formatarTamanho,
  juntarFotos,
  linkDeDownload,
  linkDeDownloadValido,
  listaVencida,
  listarAlbuns,
  loteGrande,
  normalizarAlbuns,
  normalizarPagina,
  paginaDoAlbum,
  percorrerPaginas,
  rotuloDaData,
  tamanhoSomado,
  urlDaMiniatura,
  VALIDADE_SEGURA_MS,
  type FotoAlbum,
  type PaginaAlbum,
} from "../lib/batismoFotos";

const ALBUM = "0b6f1c1e-2a3b-4c5d-8e9f-0a1b2c3d4e5f";
const ALBUM2 = "1b6f1c1e-2a3b-4c5d-8e9f-0a1b2c3d4e5f";
const FOTO = "2b6f1c1e-2a3b-4c5d-8e9f-0a1b2c3d4e5f";
const TOKEN = "eyJ1IjoiYSJ9.AbC-123_xyz";
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const foto = (n: number, tamanho: number | null = 1000): FotoAlbum => ({
  id: uuid(n),
  nome: `f${n}.jpg`,
  tamanho,
  miniatura: null,
  grande: null,
  busca: null,
});

beforeEach(() => {
  mock.apiGet.mockReset();
});

describe("destino do aviso `batismo`", () => {
  it("álbum publicado (destino fotos + album_id válido) abre a galeria daquele álbum", () => {
    expect(destinoNotificacaoBatismo({ tipo: "batismo", destino: "fotos", album_id: ALBUM })).toEqual({
      pathname: "/batismo-fotos",
      params: { album: ALBUM },
    });
  });

  it("lembrete antigo, sem album_id, continua indo para /batismo", () => {
    expect(destinoNotificacaoBatismo({ tipo: "batismo" })).toBe("/batismo");
    expect(destinoNotificacaoBatismo({ tipo: "batismo", destino: "fotos" })).toBe("/batismo");
  });

  it("album_id que não é UUID nunca vira destino (cai em /batismo)", () => {
    for (const ruim of ["../perfil", "abc", "", 123, null, `${ALBUM}/../x`, `${ALBUM} `]) {
      expect(destinoNotificacaoBatismo({ tipo: "batismo", destino: "fotos", album_id: ruim })).toBe("/batismo");
    }
  });

  it("outro destino com album_id válido não abre a galeria", () => {
    expect(destinoNotificacaoBatismo({ tipo: "batismo", destino: "lembrete", album_id: ALBUM })).toBe("/batismo");
    expect(destinoNotificacaoBatismo({ tipo: "batismo", album_id: ALBUM })).toBe("/batismo");
  });
});

describe("miniatura · só o caminho do servidor, montado sobre a base da API", () => {
  it("caminho certo vira URL absoluta", () => {
    const caminho = `/app/batismo/fotos/miniatura/${TOKEN}`;
    expect(urlDaMiniatura(caminho)).toBe(`https://www.cbrio.org/api${caminho}`);
    expect(BASE_API).toBe("https://www.cbrio.org/api");
  });

  it("qualquer outra coisa é recusada", () => {
    const ruins: unknown[] = [
      `https://evil.example/app/batismo/fotos/miniatura/${TOKEN}`,
      `//evil.example/app/batismo/fotos/miniatura/${TOKEN}`,
      `/app/batismo/fotos/${ALBUM}/itens`,
      "/app/batismo/fotos/miniatura/",
      "/app/batismo/fotos/miniatura/..",
      "/app/batismo/fotos/miniatura/../../perfil",
      "/app/batismo/fotos/miniatura/%2e%2e%2fperfil",
      `/app/batismo/fotos/miniatura/${TOKEN}?redirect=https://evil`,
      `/app/batismo/fotos/miniatura/${TOKEN}#x`,
      `/app/batismo/fotos/miniatura/${TOKEN}/extra`,
      `/app/batismo/fotos/miniatura/a b`,
      `/api/app/batismo/fotos/miniatura/${TOKEN}`,
      "",
      null,
      42,
    ];
    for (const r of ruins) expect(urlDaMiniatura(r), String(r)).toBeNull();
  });
});

describe("link do original · só https em *.sharepoint.com", () => {
  it("link do SharePoint vale (host em qualquer caixa)", () => {
    expect(linkDeDownloadValido("https://cbrio.sharepoint.com/sites/x/_layouts/15/download.aspx?UniqueId=1&tempauth=abc")).toBe(true);
    expect(linkDeDownloadValido("https://CBRIO-my.SharePoint.com/personal/x/download.aspx?a=1")).toBe(true);
  });

  it("http, outro host, host que só parece SharePoint, credencial embutida e porta estranha: não", () => {
    for (const ruim of [
      "http://cbrio.sharepoint.com/x",
      "https://cbrio.sharepoint.com.evil.example/x",
      "https://evil.example/?h=.sharepoint.com",
      "https://evilsharepoint.com/x",
      "https://sharepoint.com/x",
      "https://user:senha@cbrio.sharepoint.com/x",
      "https://cbrio.sharepoint.com:8443/x",
      "javascript:alert(1)//.sharepoint.com",
      "file:///etc/passwd",
      "",
      null,
      undefined,
      {},
    ]) {
      expect(linkDeDownloadValido(ruim), String(ruim)).toBe(false);
    }
  });
});

describe("normalização das respostas", () => {
  it("álbuns: descarta malformados e ordena do mais recente", () => {
    const r = normalizarAlbuns({
      conta: "ok",
      albuns: [
        { id: ALBUM, data_batismo: "2026-03-01", situacao: "liberado", total: 120, publicado_em: "2026-03-05T10:00:00Z" },
        { id: ALBUM2, data_batismo: "2026-11-22", situacao: "conflito", total: null, publicado_em: null },
        { id: "nao-uuid", data_batismo: "2026-01-01", situacao: "liberado" },
        { id: FOTO, data_batismo: "22/11/2026", situacao: "liberado" },
        { id: FOTO, data_batismo: "2026-01-01", situacao: "oculto" },
        null,
      ],
    });
    expect(r.conta).toBe("ok");
    expect(r.albuns.map((a) => a.id)).toEqual([ALBUM2, ALBUM]);
    expect(r.albuns[1].total).toBe(120);
  });

  it("conta desconhecida ou resposta vazia vira sem_cadastro, sem álbum", () => {
    expect(normalizarAlbuns(null)).toEqual({ conta: "sem_cadastro", albuns: [], busca_facial: null });
    expect(normalizarAlbuns({ conta: "sem_cadastro" })).toEqual({ conta: "sem_cadastro", albuns: [], busca_facial: null });
  });

  it("página: URL absoluta validada; caminho fora do padrão vira null (a foto continua na grade)", () => {
    const p = normalizarPagina({
      album: { id: ALBUM, data_batismo: "2026-11-22", total: 2 },
      fotos: [
        { id: FOTO, nome: "IMG_1.jpg", tamanho: 1234, miniatura_url: `/app/batismo/fotos/miniatura/${TOKEN}`, grande_url: "https://evil.example/x.jpg" },
        { id: "x", nome: "sem id valido" },
      ],
      proximo_cursor: "3.abc",
    });
    expect(p.fotos).toEqual([
      { id: FOTO, nome: "IMG_1.jpg", tamanho: 1234, miniatura: `${BASE_API}/app/batismo/fotos/miniatura/${TOKEN}`, grande: null, busca: null },
    ]);
    expect(p.proximoCursor).toBe("3.abc");
    expect(normalizarPagina({ fotos: [] }).proximoCursor).toBeNull();
  });

  it("juntar páginas nunca repete id", () => {
    const r = juntarFotos([foto(1), foto(2)], [foto(2), foto(3), foto(3)]);
    expect(r.map((f) => f.id)).toEqual([uuid(1), uuid(2), uuid(3)]);
  });
});

describe("percorrer páginas (Selecionar todas / renovar mantendo a posição)", () => {
  const paginas: Record<string, PaginaAlbum> = {
    inicio: { album: { id: ALBUM, data_batismo: "2026-11-22", total: 5 }, fotos: [foto(1), foto(2)], proximoCursor: "c1" },
    c1: { album: { id: ALBUM, data_batismo: "2026-11-22", total: 5 }, fotos: [foto(3), foto(4)], proximoCursor: "c2" },
    c2: { album: { id: ALBUM, data_batismo: "2026-11-22", total: 5 }, fotos: [foto(5)], proximoCursor: null },
  };
  const buscar = vi.fn(async (c: string | null) => paginas[c ?? "inicio"]);
  beforeEach(() => buscar.mockClear());

  it("do zero até o fim", async () => {
    const r = await percorrerPaginas(buscar, { fotos: [], cursor: null });
    expect(r.fotos).toHaveLength(5);
    expect(r.cursor).toBeNull();
    expect(buscar.mock.calls.map((c) => c[0])).toEqual([null, "c1", "c2"]);
  });

  it("para quando já tem o que precisava (renovar mantendo 3 fotos busca 2 páginas)", async () => {
    const r = await percorrerPaginas(buscar, { fotos: [], cursor: null }, (n) => n >= 3);
    expect(r.fotos).toHaveLength(4);
    expect(r.cursor).toBe("c2");
  });

  it("continua de onde parou e não busca nada se já está no fim", async () => {
    const r = await percorrerPaginas(buscar, { fotos: [foto(1), foto(2)], cursor: "c1" });
    expect(r.fotos).toHaveLength(5);
    expect(buscar.mock.calls.map((c) => c[0])).toEqual(["c1", "c2"]);
    buscar.mockClear();
    const fim = await percorrerPaginas(buscar, { fotos: r.fotos, cursor: null });
    expect(buscar).not.toHaveBeenCalled();
    expect(fim.fotos).toHaveLength(5);
  });

  it("servidor que devolve o mesmo cursor (ou página sem id novo) não vira laço infinito", async () => {
    const preso = vi.fn(async () => ({ ...paginas.inicio, proximoCursor: "c1" }));
    const r = await percorrerPaginas(preso, { fotos: [], cursor: null });
    expect(preso).toHaveBeenCalledTimes(2);
    expect(r.cursor).toBeNull();
    expect(r.fotos).toHaveLength(2);
  });

  it("erro no meio sobe para a tela (não vira 'acabaram as fotos')", async () => {
    const falha = vi.fn(async (c: string | null) => {
      if (c) throw Object.assign(new Error("x"), { status: 503 });
      return paginas.inicio;
    });
    await expect(percorrerPaginas(falha, { fotos: [], cursor: null })).rejects.toThrow();
  });
});

describe("erro da API → o que a tela faz", () => {
  const erro = (status: number, corpo: unknown = null) => Object.assign(new Error("x"), { status, corpo });
  it("404 = sem acesso; 409 = conflito com o texto do servidor; 400 = cursor", () => {
    expect(classificarErroFotos(erro(404, { codigo: "sem_acesso" }))).toEqual({ tipo: "sem_acesso" });
    expect(classificarErroFotos(erro(409, { codigo: "conflito", error: "Texto do servidor" }))).toEqual({
      tipo: "conflito",
      mensagem: "Texto do servidor",
    });
    expect(classificarErroFotos(erro(409, {}))).toEqual({ tipo: "conflito", mensagem: null });
    expect(classificarErroFotos(erro(400))).toEqual({ tipo: "cursor" });
  });

  it("⚠️ 503, rede e o resto viram FALHA (tentar de novo), nunca álbum vazio", () => {
    expect(classificarErroFotos(erro(503, { error: "Não foi possível carregar" }))).toEqual({ tipo: "falha" });
    expect(classificarErroFotos(new TypeError("Network request failed"))).toEqual({ tipo: "falha" });
    expect(classificarErroFotos(undefined)).toEqual({ tipo: "falha" });
  });
});

describe("tamanho, lote grande e pequenas réguas", () => {
  it("soma o que sabe e conta o que não sabe", () => {
    expect(tamanhoSomado([foto(1, 10), foto(2, null), foto(3, 5)])).toEqual({ bytes: 15, desconhecidas: 1 });
  });

  it("formata em MB/GB", () => {
    expect(formatarTamanho(0)).toBe("0 MB");
    expect(formatarTamanho(300 * 1024)).toBe("1 MB");
    expect(formatarTamanho(5.5 * 1024 * 1024)).toBe("5,5 MB");
    expect(formatarTamanho(182 * 1024 * 1024)).toBe("182 MB");
    expect(formatarTamanho(1.5 * 1024 * 1024 * 1024)).toBe("1,5 GB");
  });

  it("lote grande = 10 fotos ou 50 MB", () => {
    expect(loteGrande(Array.from({ length: 9 }, (_, i) => foto(i, 1)))).toBe(false);
    expect(loteGrande(Array.from({ length: 10 }, (_, i) => foto(i, 1)))).toBe(true);
    expect(loteGrande([foto(1, 30 * 1024 * 1024), foto(2, 25 * 1024 * 1024)])).toBe(true);
  });

  it("data em pt-BR e lista vencida pela idade dos tokens", () => {
    expect(rotuloDaData("2026-11-22")).toBe("22/11/2026");
    expect(listaVencida(null, 10)).toBe(false);
    expect(listaVencida(1000, 1000 + VALIDADE_SEGURA_MS - 1)).toBe(false);
    expect(listaVencida(1000, 1000 + VALIDADE_SEGURA_MS)).toBe(true);
    // O token vence em 2 h no mínimo: a margem tem que ser menor que isso.
    expect(VALIDADE_SEGURA_MS).toBeLessThan(2 * 3600 * 1000);
  });

  it("álbum inicial: o pedido (se a conta tem), senão o liberado", () => {
    const albuns = normalizarAlbuns({
      conta: "ok",
      albuns: [
        { id: ALBUM, data_batismo: "2026-03-01", situacao: "liberado" },
        { id: ALBUM2, data_batismo: "2026-11-22", situacao: "conflito" },
      ],
    }).albuns;
    expect(albumInicial(albuns, ALBUM2)?.id).toBe(ALBUM2);
    expect(albumInicial(albuns, FOTO)?.id).toBe(ALBUM);
    expect(albumInicial(albuns)?.id).toBe(ALBUM);
    expect(albumInicial([])).toBeNull();
  });
});

describe("chamadas (apiGet falso)", () => {
  it("lista álbuns normalizados", async () => {
    mock.apiGet.mockResolvedValue({ conta: "ok", albuns: [{ id: ALBUM, data_batismo: "2026-11-22", situacao: "liberado", total: 3 }] });
    const r = await listarAlbuns();
    expect(mock.apiGet).toHaveBeenCalledWith("/app/batismo/fotos");
    expect(r.albuns[0].id).toBe(ALBUM);
  });

  it("página: cursor codificado, limite 60; álbum que não é UUID nem sai do app", async () => {
    mock.apiGet.mockResolvedValue({ album: {}, fotos: [], proximo_cursor: null });
    await paginaDoAlbum(ALBUM, "3.a&b=c");
    expect(mock.apiGet).toHaveBeenCalledWith(`/app/batismo/fotos/${ALBUM}/itens?cursor=3.a%26b%3Dc&limite=60`);
    await paginaDoAlbum(ALBUM);
    expect(mock.apiGet).toHaveBeenLastCalledWith(`/app/batismo/fotos/${ALBUM}/itens?limite=60`);
    mock.apiGet.mockClear();
    await expect(paginaDoAlbum("../perfil")).rejects.toMatchObject({ status: 404 });
    expect(mock.apiGet).not.toHaveBeenCalled();
  });

  it("download: só devolve link do SharePoint; link fora do padrão falha SEM citar a URL", async () => {
    mock.apiGet.mockResolvedValue({ url: "https://cbrio.sharepoint.com/d?tempauth=x", nome: "IMG.jpg", tamanho: 9, validade_s: 600 });
    await expect(linkDeDownload(ALBUM, FOTO)).resolves.toEqual({
      url: "https://cbrio.sharepoint.com/d?tempauth=x",
      nome: "IMG.jpg",
      tamanho: 9,
      validadeS: 600,
    });
    expect(mock.apiGet).toHaveBeenCalledWith(`/app/batismo/fotos/${ALBUM}/itens/${FOTO}/download`);
    mock.apiGet.mockResolvedValue({ url: "https://evil.example/segredo-123", nome: "x" });
    const e = await linkDeDownload(ALBUM, FOTO).catch((x: Error) => x);
    expect(e).toBeInstanceOf(Error);
    expect((e as Error).message).not.toContain("evil.example");
  });
});
