import { describe, expect, it } from "vitest";
import { StackRouter } from "@react-navigation/routers";
import { abaDaRota, caminhoDaRota, trocarDeAba, type RotaPilha } from "../lib/abas";

// Memória por aba (27/11/2026). Pilha = rotas do Stack das telas principais.
const r = (name: string, key = name, params?: object): RotaPilha => ({ key, name, params });
const nomes = (rotas: RotaPilha[]) => rotas.map((x) => x.key ?? `novo:${x.name}`);
function tocar(pilha: RotaPilha[], destino: string) {
  const t = trocarDeAba(pilha, destino);
  return t.tipo === "nada" ? pilha : t.rotas;
}

describe("a que aba cada tela pertence", () => {
  it("telas de dentro sobem a árvore até a raiz da barra", () => {
    expect(abaDaRota("/escala-supervisor")).toBe("/voluntariado");
    expect(abaDaRota("/liturgia")).toBe("/voluntariado");
    expect(abaDaRota("/grupo-membros")).toBe("/meu-grupo");
    expect(abaDaRota("/biblia")).toBe("/devocional");
    expect(abaDaRota("/devocional-leituras")).toBe("/devocional");
    expect(abaDaRota("/voluntariado")).toBe("/voluntariado");
  });
  it("Home, avisos e o que é do menu ficam fora das abas", () => {
    for (const c of ["/", "/notificacoes", "/perfil", "/menu", "/tela-sem-mapa"]) expect(abaDaRota(c)).toBeNull();
    expect(caminhoDaRota("index")).toBe("/");
  });
});

describe("trocar de aba pela barra", () => {
  it("exemplo do Marcos: escalando, olha Grupos e volta ao Servir na MESMA tela", () => {
    let pilha = [r("index"), r("voluntariado"), r("escala-supervisor", "escala-1")];
    pilha = tocar(pilha, "/meu-grupo");
    expect(nomes(pilha)).toEqual(["index", "voluntariado", "escala-1", "novo:meu-grupo"]);
    pilha = [...pilha.slice(0, -1), r("meu-grupo"), r("grupo-membros", "membros-1")];
    pilha = tocar(pilha, "/voluntariado");
    // A escala que estava aberta volta ao topo com a mesma key: é a mesma tela, viva.
    expect(nomes(pilha)).toEqual(["index", "meu-grupo", "membros-1", "voluntariado", "escala-1"]);
    pilha = tocar(pilha, "/meu-grupo");
    expect(nomes(pilha)).toEqual(["index", "voluntariado", "escala-1", "meu-grupo", "membros-1"]);
  });

  it("aba ainda não aberta entra pela raiz", () => {
    expect(nomes(tocar([r("index")], "/cuidados"))).toEqual(["index", "novo:cuidados"]);
  });

  it("tocar na aba acesa numa tela de dentro volta ao início dela (reaproveitando a raiz viva)", () => {
    const pilha = [r("index"), r("meu-grupo"), r("voluntariado"), r("escala-supervisor")];
    expect(nomes(tocar(pilha, "/voluntariado"))).toEqual(["index", "meu-grupo", "voluntariado"]);
  });

  it("tocar na aba acesa já na raiz não faz nada", () => {
    expect(trocarDeAba([r("index"), r("voluntariado")], "/voluntariado")).toEqual({ tipo: "nada" });
  });

  it("a Home fica sempre no fundo e telas fora das abas não somem", () => {
    const pilha = [r("index"), r("perfil"), r("devocional"), r("biblia")];
    expect(nomes(tocar(pilha, "/generosidade"))).toEqual(["index", "perfil", "devocional", "biblia", "novo:generosidade"]);
  });

  it("ir e voltar entre abas NÃO faz a pilha crescer (antes: uma tela nova por toque)", () => {
    let pilha = [r("index")];
    const ordem = ["/devocional", "/voluntariado", "/meu-grupo", "/cuidados", "/generosidade"];
    for (let volta = 0; volta < 20; volta++) for (const aba of ordem) {
      pilha = tocar(pilha, aba);
      // Só a primeira visita cria a raiz; as seguintes reaproveitam a key.
      pilha = pilha.map((x) => (x.key ? x : { ...x, key: x.name }));
    }
    expect(pilha).toHaveLength(6);
    expect(new Set(nomes(pilha)).size).toBe(6);
  });

  it("parâmetros da tela de dentro não mudam a aba dela", () => {
    const pilha = [r("index"), r("devocional"), r("devocional-plano-dia", "dia", { planoId: "p1" }), r("voluntariado")];
    expect(nomes(tocar(pilha, "/devocional"))).toEqual(["index", "voluntariado", "devocional", "dia"]);
  });
});

// Prova do motivo da mudança, no roteador de verdade (o do React Navigation 7):
// NAVIGATE para uma tela que já está na pilha, mas não no topo, EMPILHA outra.
describe("o roteador do app (por que a barra deixou de usar navigate)", () => {
  const nomesDoStack = ["index", "devocional", "biblia", "voluntariado"];
  const router = StackRouter({});
  const opts = { routeNames: nomesDoStack, routeParamList: {}, routeGetIdList: {} };
  it("navigate empilha cópia nova; reset com as mesmas keys reordena sem recriar", () => {
    let s = router.getInitialState(opts);
    for (const name of ["devocional", "biblia", "voluntariado", "devocional"]) {
      s = router.getStateForAction(s, { type: "NAVIGATE", payload: { name, params: {} } }, opts) as typeof s;
    }
    expect(s.routes.map((x) => x.name)).toEqual(["index", "devocional", "biblia", "voluntariado", "devocional"]);

    let v = router.getInitialState(opts);
    for (const name of ["devocional", "biblia", "voluntariado"]) {
      v = router.getStateForAction(v, { type: "NAVIGATE", payload: { name, params: {} } }, opts) as typeof v;
    }
    const keysAntes = v.routes.map((x) => x.key);
    const troca = trocarDeAba(v.routes, "/devocional");
    expect(troca.tipo).toBe("pilha");
    const rotas = (troca as { rotas: typeof v.routes }).rotas;
    const depois = router.getStateForAction(v, { type: "RESET", payload: { ...v, routes: rotas, index: rotas.length - 1 } }, opts) as typeof v;
    expect(depois.routes.map((x) => x.name)).toEqual(["index", "voluntariado", "devocional", "biblia"]);
    expect([...depois.routes.map((x) => x.key)].sort()).toEqual([...keysAntes].sort());
  });
});
