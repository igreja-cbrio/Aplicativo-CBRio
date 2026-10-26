import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { MENU_SECTIONS, QUICK_LINKS } from "../lib/appNavigation";

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
    for (const href of ["/agenda", "/kids", "/next", "/batismo", "/apresentacao-crianca", "/inscricoes", "/conteudos"]) {
      expect(destinations).toContain(href);
    }
  });
  it("Home, rodapé e menu usam os mesmos destinos dos cinco atalhos", () => {
    expect(QUICK_LINKS).toHaveLength(5);
    for (const shortcut of QUICK_LINKS) expect(items).toContainEqual(shortcut);
    expect(QUICK_LINKS.find((item) => item.label === "Grupos")?.href).toBe("/meu-grupo");
  });
});
