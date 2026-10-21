// Módulo Conteúdos (21/10/2026): régua do catálogo e do player do Vimeo.
import { describe, expect, it } from "vitest";
import {
  ORIGEM_VIMEO,
  filtrarCatalogo,
  htmlDoVimeo,
  navegacaoVimeoPermitida,
  type ConteudoItem,
  type ConteudoVideo,
} from "@/lib/conteudos";

const video = (o: Partial<ConteudoVideo> & { id: string }): ConteudoVideo => ({
  tipo: "video", vimeo_id: "1", vimeo_hash: null, titulo: "Vídeo",
  categoria_id: null, thumbnail_url: null, duracao_seg: 60,
  data_conteudo: "2023-01-01", publicado_em: "2026-10-21T12:00:00Z", destaque: false,
  ...o,
} as ConteudoVideo);

const pasta = (o: Partial<ConteudoItem> & { id: string }): ConteudoItem => ({
  tipo: "pasta", titulo: "Pasta", descricao: null, categoria_id: null,
  capa_url: null, data_conteudo: "2023-01-01", publicado_em: "2026-10-21T12:00:00Z",
  destaque: false, partes: [],
  ...o,
} as ConteudoItem);

const ITENS: ConteudoItem[] = [
  pasta({ id: "p1", titulo: "Intimidade com o Pai", categoria_id: "c1", data_conteudo: "2023-02-03" }),
  pasta({
    id: "p2", titulo: "Descomplicando a Bíblia · Pentateuco", categoria_id: "c1", data_conteudo: "2021-07-02",
    partes: [video({ id: "v1", titulo: "Aula 7 - Deuteronômio" })],
  }),
  video({ id: "v9", titulo: "Vídeo de apresentação - Universidade CBRIO", categoria_id: "c2", data_conteudo: "2021-07-02", publicado_em: "2026-10-20T12:00:00Z" }),
  video({ id: "v8", titulo: "Culto especial", categoria_id: "c2", data_conteudo: "2025-05-01", publicado_em: "2026-10-19T12:00:00Z" }),
];

describe("filtrarCatalogo", () => {
  it("busca sem acento e sem caixa acha a pasta", () => {
    for (const termo of ["intimidade", "intimidadé", "INTIMIDADE"]) {
      const r = filtrarCatalogo(ITENS, { termo, ordem: "recentes" });
      expect(r.map((i) => i.id)).toEqual(["p1"]);
    }
  });

  it("busca pelo título de uma PARTE mostra a pasta dela", () => {
    const r = filtrarCatalogo(ITENS, { termo: "deuteronomio", ordem: "recentes" });
    expect(r.map((i) => i.id)).toEqual(["p2"]);
  });

  it("filtra por categoria", () => {
    const r = filtrarCatalogo(ITENS, { categoriaId: "c2", ordem: "recentes" });
    expect(r.map((i) => i.id)).toEqual(["v8", "v9"]);
  });

  it("ordena por data_conteudo: antigos põe 2021 antes de 2025; recentes inverte", () => {
    const antigos = filtrarCatalogo(ITENS, { ordem: "antigos" });
    expect(antigos.map((i) => i.data_conteudo)[0]).toBe("2021-07-02");
    const recentes = filtrarCatalogo(ITENS, { ordem: "recentes" });
    expect(recentes[0].data_conteudo).toBe("2025-05-01");
  });

  it("sem data vai pro fim nas duas ordens; destaque NÃO fura a ordem", () => {
    const comNull = [...ITENS, video({ id: "v0", titulo: "Sem data", data_conteudo: null, destaque: true })];
    for (const ordem of ["recentes", "antigos"] as const) {
      const r = filtrarCatalogo(comNull, { ordem });
      expect(r[r.length - 1].id).toBe("v0");
    }
  });
});

describe("htmlDoVimeo", () => {
  it("monta o iframe do player com referrer de origem", () => {
    const html = htmlDoVimeo("570280899", null);
    expect(html).toContain("player.vimeo.com/video/570280899");
    expect(html).toContain('referrerpolicy="origin"');
    expect(html).toContain('<meta name="referrer" content="origin"');
    // Sem hash a query começa direto no playsinline ("h=" solto casaria com
    // o "width=" do viewport — por isso a âncora é a URL inteira).
    expect(html).toContain("player.vimeo.com/video/570280899?playsinline=1");
  });

  it("inclui o hash de vídeo não listado", () => {
    expect(htmlDoVimeo("123456789", "abc123")).toContain("video/123456789?h=abc123&playsinline=1");
  });

  it("id ou hash fora do formato não entram no HTML (nada de injeção)", () => {
    expect(htmlDoVimeo('1"><script>alert(1)</script>', null)).not.toContain("<script>alert");
    expect(htmlDoVimeo("570280899", 'x"><script>x</script>')).not.toContain("<script>x");
  });
});

describe("navegacaoVimeoPermitida", () => {
  it("frame principal: só a própria origem e about:blank", () => {
    expect(navegacaoVimeoPermitida(`${ORIGEM_VIMEO}/`, true)).toBe(true);
    expect(navegacaoVimeoPermitida("about:blank", true)).toBe(true);
    expect(navegacaoVimeoPermitida("https://vimeo.com/570280899", true)).toBe(false);
    expect(navegacaoVimeoPermitida("https://evil.example/", true)).toBe(false);
    // ⚠️ Prefixo não basta: domínio colado (achado da revisão de 21/10).
    expect(navegacaoVimeoPermitida("https://www.cbrio.com.br.evil.tld/", true)).toBe(false);
  });

  it("subframes (o player) carregam à vontade", () => {
    expect(navegacaoVimeoPermitida("https://player.vimeo.com/x", false)).toBe(true);
  });
});
