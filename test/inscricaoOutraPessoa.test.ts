import { beforeEach, describe, expect, it, vi } from "vitest";
import { router } from "expo-router";
import { destinoInscricaoOutraPessoa } from "../lib/eventoDestino";
vi.mock("expo-web-browser", () => ({ openBrowserAsync: vi.fn() }));
vi.mock("../lib/telemetria", () => ({ trackEvento: vi.fn() }));
import { inscreverOutraPessoa } from "../lib/eventos";
import { openBrowserAsync } from "expo-web-browser";

describe("inscrever outra pessoa sem usar a identidade do titular", () => {
  beforeEach(() => vi.clearAllMocks());
  it.each(["/inscricao-batismo", "/inscricao-grupos", "/next", "/quero-servir"])("mantém %s dentro do app sem sessão ou dados pessoais", path => {
    const url = `https://www.cbrio.org${path}`;
    expect(destinoInscricaoOutraPessoa(url)).toEqual({ pathname: "/inscricao-formulario", params: { url, para: "outra-pessoa" } });
    const push = vi.spyOn(router, "push");
    expect(inscreverOutraPessoa(url)).toBe(true);
    expect(push).toHaveBeenCalledWith(destinoInscricaoOutraPessoa(url));
    expect(openBrowserAsync).not.toHaveBeenCalled();
  });
  it("abre os campos nativos de outro participante na Classe de Batismo", () => {
    expect(destinoInscricaoOutraPessoa("https://www.cbrio.org/evento/classe-batismo")).toEqual({
      pathname: "/inscricao-participante", params: { slug: "classe-batismo" },
    });
  });
  it("abre uma nova instância a cada participante, mesmo no mesmo evento", () => {
    const push = vi.spyOn(router, "push");
    const navigate = vi.spyOn(router, "navigate");
    inscreverOutraPessoa("https://cbrio.org/evento/familias");
    inscreverOutraPessoa("https://cbrio.org/evento/familias");
    expect(push).toHaveBeenCalledTimes(2);
    expect(navigate).not.toHaveBeenCalled();
  });
  it.each([undefined, null, "", "http://cbrio.org/next", "https://cbrio.org.falso.test/next", "https://usuario@cbrio.org/next"])("não volta para inscrição do titular quando o catálogo não tem link seguro: %s", url => {
    const push = vi.spyOn(router, "push");
    const navigate = vi.spyOn(router, "navigate");
    expect(inscreverOutraPessoa(url)).toBe(false);
    expect(push).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
    expect(openBrowserAsync).not.toHaveBeenCalled();
  });
});
