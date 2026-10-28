import { describe, expect, it } from "vitest";
import { destinoNotificacaoEvento, eventoCorresponde, urlFormularioEvento, urlPublicaCbrio } from "../lib/eventoDestino";

describe("inscrição dentro do app", () => {
  it("abre push novo pelo ID e legado pelo slug na tela do evento", () => {
    expect(destinoNotificacaoEvento({ evento_id: "id-1", slug: "classe-batismo" })).toEqual({ pathname: "/evento", params: { id: "id-1" } });
    expect(destinoNotificacaoEvento({ slug: "classe-batismo" })).toEqual({ pathname: "/evento", params: { slug: "classe-batismo" } });
    expect(destinoNotificacaoEvento({ slug: "https://fora.test" })).toBe("/inscricoes");
    expect(destinoNotificacaoEvento({ evento_id: 12 })).toBe("/inscricoes");
  });
  it("resolve o evento do catálogo ou da inscrição por id ou slug", () => {
    const e = { id: "id-1", slug: "classe-batismo" };
    expect(eventoCorresponde(e, undefined, e.slug)).toBe(true);
    expect(eventoCorresponde(e, "id-2", e.slug)).toBe(false);
    expect(eventoCorresponde(e, e.id)).toBe(true);
    expect(eventoCorresponde(e)).toBe(false);
  });
  it("distingue formulário de pagamento e comprovante", () => {
    expect(urlFormularioEvento("classe-batismo")).toBe("https://www.cbrio.org/evento/classe-batismo");
    expect(urlFormularioEvento("https://cbrio.org/evento/classe-batismo?origem=app")).toBeTruthy();
    expect(urlFormularioEvento("https://www.cbrio.org/pagamento/token")).toBeNull();
    expect(urlFormularioEvento("https://www.cbrio.org/i/c/token")).toBeNull();
    expect(urlPublicaCbrio("https://www.cbrio.org/pagamento/token")).toBeTruthy();
  });
  it.each([
    "https://cbrio.org.falso.com/evento/abc", "https://falso.com/evento/abc",
    "https://usuario:senha@cbrio.org/evento/abc", "http://cbrio.org/evento/abc",
    "https://cbrio.org:123/evento/abc", "javascript:alert(1)", "file:///etc/hosts", "data:text/html,abc", "//cbrio.org/evento/abc",
  ])("bloqueia origem ou esquema impróprio: %s", (url) => {
    expect(urlPublicaCbrio(url)).toBeNull();
    expect(urlFormularioEvento(url)).toBeNull();
  });
});
