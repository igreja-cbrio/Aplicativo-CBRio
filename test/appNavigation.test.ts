import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { MENU_SECTIONS, QUICK_LINKS, ROTA_CENSO, chromeDaTela } from "../lib/appNavigation";
import { rotaPai } from "../lib/hierarquia";
import { DESTINO_AVISOS, abaInicial, censoNoMenu } from "../lib/menuRegras";

describe("menu lateral e atalhos do app", () => {
  const items = MENU_SECTIONS.flatMap((section) => [...section.items]);
  it("não oferece destinos inexistentes nem duplicados", () => {
    const destinations = items.map((item) => item.href);
    expect(new Set(destinations).size).toBe(destinations.length);
    for (const href of destinations) {
      expect(existsSync(resolve("app/(app)", href === "/" ? "index.tsx" : `${href.slice(1)}.tsx`)), href).toBe(true);
    }
  });
  it("mantém acessíveis recursos retirados do antigo bloco da Home", () => {
    const destinations = items.map((item) => item.href);
    // Inscrições reúne Batismo/NEXT/apresentação; Kids tem item próprio.
    for (const href of ["/agenda", "/kids-area", "/inscricoes"]) {
      expect(destinations).toContain(href);
    }
    // 25/11/2026: avisos e notificações viraram UM item; a família foi pro perfil.
    expect(destinations).not.toContain("/noticias");
    expect(destinations).not.toContain("/familia");
    expect(destinations.filter((href) => href === "/notificacoes")).toHaveLength(1);
    expect(rotaPai("/familia")).toBe("/perfil");
    // Conteúdos mudou pra dentro do Devocional (porta própria), fora do menu.
    expect(destinations).not.toContain("/conteudos");
    expect(destinations).toContain("/videos");
  });
  it("Home, rodapé e menu usam os mesmos destinos dos cinco atalhos", () => {
    expect(QUICK_LINKS).toHaveLength(5);
    for (const shortcut of QUICK_LINKS) expect(items).toContainEqual(shortcut);
    expect(QUICK_LINKS.find((item) => item.label === "Grupos")?.href).toBe("/meu-grupo");
  });
});


describe("casca durante a volta interativa para a Home", () => {
  it("mantém a Home de fundo sem cabeçalho extra enquanto Notificações está aberta", () => {
    expect(chromeDaTela("notificacoes")).toMatchObject({ header: true, dock: true });
    expect(chromeDaTela("index")).toEqual(chromeDaTela("/"));
    expect(chromeDaTela("index")).toMatchObject({ header: false, dock: true });
    // Cancelar o gesto preserva a mesma casca de Notificações, sem depender do foco.
    expect(chromeDaTela("/notificacoes")).toEqual(chromeDaTela("notificacoes"));
  });
  it("formulários protegidos não ganham cabeçalho ou atalhos de saída", () => {
    for (const rota of ["completar-cadastro", "/completar-cadastro", "inscricao-formulario", "/inscricao-formulario"]) {
      expect(chromeDaTela(rota)).toMatchObject({ header: false, dock: false });
    }
  });
  it("preserva a seta das abas e não duplica a seta própria de Notificações", () => {
    for (const rota of ["meu-grupo", "voluntariado", "cuidados", "devocional", "menu", "agenda"]) {
      expect(chromeDaTela(rota)).toMatchObject({ header: true, dock: true, voltar: true });
    }
    expect(chromeDaTela("notificacoes").voltar).toBe(false);
  });
});

describe("tela única de avisos e notificações", () => {
  it("a Home abre em Avisos; o menu e o sino, em Notificações", () => {
    expect(DESTINO_AVISOS).toEqual({ pathname: "/notificacoes", params: { aba: "avisos" } });
    expect(abaInicial(DESTINO_AVISOS.params.aba, "/notificacoes")).toBe("avisos");
    expect(abaInicial(undefined, "/notificacoes")).toBe("notificacoes");
  });
  it("a porta antiga /noticias cai em Avisos e parâmetro estranho não quebra", () => {
    expect(abaInicial(undefined, "/noticias")).toBe("avisos");
    expect(abaInicial("notificacoes", "/noticias")).toBe("notificacoes");
    expect(abaInicial("qualquer", "/notificacoes")).toBe("notificacoes");
    expect(abaInicial(["avisos", "x"], "/notificacoes")).toBe("avisos");
  });
});

describe("Censo no menu", () => {
  it("o item existe na lista e é o único condicionado", () => {
    expect(MENU_SECTIONS.flatMap((s) => [...s.items]).map((i) => i.href)).toContain(ROTA_CENSO);
  });
  it("só aparece com censo aberto esperando resposta", () => {
    expect(censoNoMenu({ pesquisa: { slug: "censo-2026" }, ja_respondeu: false })).toBe(true);
    expect(censoNoMenu({ pesquisa: { slug: "censo-2026" } })).toBe(true);
    expect(censoNoMenu({ pesquisa: { slug: "censo-2026" }, ja_respondeu: true })).toBe(false);
    expect(censoNoMenu({ pesquisa: null })).toBe(false);
  });
  it("não pisca enquanto carrega e não some por erro de rede", () => {
    expect(censoNoMenu(undefined)).toBe(false);
    expect(censoNoMenu(null)).toBe(true);
  });
});

describe("chat do assistente", () => {
  it("é tela focada: sem dock nem cabeçalho da casca", () => {
    expect(chromeDaTela("/fale-conosco-chat")).toMatchObject({ dock: false, header: false });
  });
});
