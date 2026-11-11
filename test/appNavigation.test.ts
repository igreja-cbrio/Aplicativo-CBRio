import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { MENU_SECTIONS, QUICK_LINKS, chromeDaTela } from "../lib/appNavigation";

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
    // Inscrições reúne Batismo/NEXT/apresentação; Kids fica em família/agenda.
    for (const href of ["/agenda", "/familia", "/inscricoes"]) {
      expect(destinations).toContain(href);
    }
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
