// ============================================================================
// MONTAR ESCALA POR TIME · a régua do carrossel (23/09/2026)
//
// ⚠️⚠️ O estrago que cada bloco guarda foi MEDIDO em 23/09 no Domingo - Manhã
// de 27/09/2026: 69 escalas, 36 itens de composição em 9 times — e 21 valores
// distintos de `vol_schedules.team_name` que não são time nenhum ("Vocal",
// "Chat 9:30", "Câmeras"...), porque nas linhas importadas do Planning Center o
// "team" de lá é a nossa POSIÇÃO. A tela antiga agrupava por essa string e
// mostrava 21 "equipes" de uma pessoa.
// ============================================================================
import { describe, expect, it } from "vitest";
import {
  agruparCultosPorTipo, cultoInicial, contaVaga, chaveDoTime, montarTimes,
  resumoDoCulto, destinoDoArraste, xParaCentralizar, SEM_EQUIPE, SEM_FUNCAO, SEM_TIPO,
  semanaDoCulto, ehDomingo, filtrarPool, dividirPorVaga,
  type ItemComposicao, type LinhaEscala,
} from "@/lib/escalaTimes";

const BANDA = "t-banda";
const INTEG = "t-integ";
const VOCAL = "p-vocal";
const BAIXO = "p-baixo";
const RECEP = "p-recep";

const composicao: ItemComposicao[] = [
  { team_id: INTEG, team_name: "Integração", area: "Integração", position_id: RECEP, position_name: "Recepção", quantidade: 2 },
  { team_id: BANDA, team_name: "Banda", area: "Louvor", position_id: VOCAL, position_name: "Vocal", quantidade: 2 },
  { team_id: BANDA, team_name: "Banda", area: "Louvor", position_id: BAIXO, position_name: "Baixo", quantidade: 1 },
];

const linha = (over: Partial<LinhaEscala> & { id: string; volunteer_name: string }): LinhaEscala => ({
  volunteer_id: `v-${over.id}`, team_id: null, team_name: null, position_id: null, position_name: null,
  confirmation_status: null, ...over,
});

describe("escala por time · duas etapas (tipo → data)", () => {
  const cultos = [
    { id: "a", service_type_name: "Quarta Com Deus", scheduled_at: "2026-09-23T23:00:00Z" },
    { id: "b", service_type_name: "Domingo - Manhã", scheduled_at: "2026-09-27T12:30:00Z" },
    { id: "c", service_type_name: "Quarta Com Deus", scheduled_at: "2026-09-30T23:00:00Z" },
    { id: "d", service_type_name: null, scheduled_at: "2026-10-01T20:00:00Z" },
    { id: "e", service_type_name: "Domingo - Manhã", scheduled_at: "2026-10-04T12:30:00Z" },
  ];

  it("⚠️ MUTATION GUARD · o tipo do culto mais próximo vem primeiro, e cada tipo guarda só as suas datas", () => {
    const g = agruparCultosPorTipo(cultos);
    expect(g.map((x) => x.tipo)).toEqual(["Quarta Com Deus", "Domingo - Manhã", SEM_TIPO]);
    expect(g[1].cultos.map((c) => c.id)).toEqual(["b", "e"]);
    expect(g[2].cultos.map((c) => c.id)).toEqual(["d"]);
  });

  it("ao trocar de tipo, o culto inicial é o MAIS PRÓXIMO daquele tipo; sem tipo, o mais próximo de todos", () => {
    const g = agruparCultosPorTipo(cultos);
    expect(cultoInicial(g, "Domingo - Manhã")?.id).toBe("b");
    expect(cultoInicial(g, null)?.id).toBe("a");
    expect(cultoInicial(g, "Culto que não existe")).toBeNull();
    expect(cultoInicial([], null)).toBeNull();
  });
});

describe("escala por time · a que time a linha pertence", () => {
  const porNome = new Map([["banda", BANDA], ["integração", INTEG]]);
  const porId = new Set([BANDA, INTEG]);

  it("⚠️ MUTATION GUARD · linha do Planning Center: `team_name` é a POSIÇÃO, quem diz o time é o `team_id`", () => {
    // 'Vocal' não é time nenhum → team_id manda. Era isto que virava 21 equipes.
    expect(chaveDoTime({ team_id: BANDA, team_name: "Vocal" }, porNome, porId)).toBe(BANDA);
    expect(chaveDoTime({ team_id: INTEG, team_name: "Chat 9:30" }, porNome, porId)).toBe(INTEG);
  });

  it("⚠️ MUTATION GUARD · linha MOVIDA pelo app: o nome é a escrita mais recente e vence o `team_id` velho", () => {
    // O PATCH do app grava só `team_name`; o `team_id` continua apontando pra
    // Banda. A pessoa foi movida pra Integração e é lá que tem que aparecer.
    expect(chaveDoTime({ team_id: BANDA, team_name: "Integração" }, porNome, porId)).toBe(INTEG);
    // Caixa e espaço não separam a mesma equipe.
    expect(chaveDoTime({ team_id: null, team_name: "  banda " }, porNome, porId)).toBe(BANDA);
  });

  it("linha que não casa com nada fica com o próprio nome, ou sem equipe — nunca some", () => {
    expect(chaveDoTime({ team_id: "t-outro", team_name: "Kids" }, porNome, porId)).toBe("n:Kids");
    expect(chaveDoTime({ team_id: null, team_name: null }, porNome, porId)).toBe(`n:${SEM_EQUIPE}`);
  });
});

describe("escala por time · a árvore time → posição → pessoa e a vaga", () => {
  const escalas: LinhaEscala[] = [
    linha({ id: "1", volunteer_name: "Zé", team_id: BANDA, team_name: "Vocal", position_id: VOCAL, position_name: "Vocal", confirmation_status: "confirmed" }),
    linha({ id: "2", volunteer_name: "Ana", team_id: BANDA, team_name: "Vocal", position_id: null, position_name: "vocal ", confirmation_status: "declined" }),
    linha({ id: "3", volunteer_name: "Bia", team_id: BANDA, team_name: "Banda", position_id: null, position_name: "Teclado" }),
    linha({ id: "4", volunteer_name: "Caio", team_id: INTEG, team_name: "Recepção", position_id: RECEP, position_name: "Recepção" }),
    linha({ id: "5", volunteer_name: "Duda", team_id: null, team_name: "Kids", position_id: null, position_name: null, confirmation_status: "confirmed" }),
  ];

  it("⚠️ MUTATION GUARD · agrupa por TIME (ordem da composição), não pela string `team_name`", () => {
    const times = montarTimes(composicao, escalas);
    expect(times.map((t) => t.nome)).toEqual(["Integração", "Banda", "Kids"]);
    const banda = times.find((t) => t.nome === "Banda")!;
    expect(banda.area).toBe("Louvor");
    expect(banda.total).toBe(3);
    // Nenhum time chamado "Vocal" nasceu.
    expect(times.some((t) => t.nome === "Vocal")).toBe(false);
  });

  it("posição casa por id, senão pelo NOME sem caixa/espaço; o que não casa cai em “sem função”, no FIM", () => {
    const banda = montarTimes(composicao, escalas).find((t) => t.nome === "Banda")!;
    expect(banda.posicoes.map((p) => p.nome)).toEqual(["Vocal", "Baixo", null]);
    const vocal = banda.posicoes[0];
    expect(vocal.pessoas.map((p) => p.volunteer_name)).toEqual(["Ana", "Zé"]);
    const semFuncao = banda.posicoes[2];
    expect(semFuncao.chave).toBe(SEM_FUNCAO);
    expect(semFuncao.pessoas.map((p) => p.volunteer_name)).toEqual(["Bia"]);
    expect(semFuncao.alvo).toBe(0);
  });

  it("⚠️ MUTATION GUARD · quem RECUSOU não preenche a vaga (a régua de 21/08 do servidor)", () => {
    const banda = montarTimes(composicao, escalas).find((t) => t.nome === "Banda")!;
    const vocal = banda.posicoes[0];
    // 2 pedidas · Zé confirmou, Ana recusou ⇒ 1 preenchida, falta 1.
    expect(vocal.alvo).toBe(2);
    expect(vocal.preenchidas).toBe(1);
    expect(vocal.faltam).toBe(1);
    // Ana continua LISTADA, marcada — não some.
    expect(vocal.pessoas.some((p) => p.volunteer_name === "Ana")).toBe(true);
    expect(contaVaga("declined")).toBe(false);
    expect(contaVaga("confirmed")).toBe(true);
    expect(contaVaga(null)).toBe(true);
  });

  it("a vaga nunca fica negativa, e a posição vazia da composição continua visível", () => {
    const times = montarTimes(composicao, escalas);
    const banda = times.find((t) => t.nome === "Banda")!;
    expect(banda.posicoes[1]).toMatchObject({ nome: "Baixo", alvo: 1, preenchidas: 0, faltam: 1, pessoas: [] });
    // Recepção pede 2, tem 1 pendente (conta) ⇒ falta 1.
    const integ = times.find((t) => t.nome === "Integração")!;
    expect(integ.faltam).toBe(1);
    // 3 escalados numa posição que pede 1 ⇒ faltam 0, não -2.
    const lotada = montarTimes(
      [{ team_id: BANDA, team_name: "Banda", area: null, position_id: BAIXO, position_name: "Baixo", quantidade: 1 }],
      ["a", "b", "c"].map((id) => linha({ id, volunteer_name: id, team_id: BANDA, team_name: "Banda", position_id: BAIXO, position_name: "Baixo" })),
    );
    expect(lotada[0].posicoes[0].faltam).toBe(0);
  });

  it("time só de gente (fora da composição) e time só de vaga (sem gente) coexistem; o resumo soma tudo", () => {
    const times = montarTimes(composicao, escalas);
    const kids = times.find((t) => t.nome === "Kids")!;
    expect(kids.alvo).toBe(0);
    expect(kids.confirmados).toBe(1);
    const r = resumoDoCulto(times);
    expect(r).toEqual({ total: 5, confirmados: 2, recusados: 1, faltam: 3 });
    expect(resumoDoCulto([])).toEqual({ total: 0, confirmados: 0, recusados: 0, faltam: 0 });
  });

  it("dois itens da composição pra mesma posição (time split, um por horário) SOMAM o alvo", () => {
    const dupla: ItemComposicao[] = [
      { team_id: BANDA, team_name: "Banda", area: null, position_id: VOCAL, position_name: "Vocal", quantidade: 2 },
      { team_id: BANDA, team_name: "Banda", area: null, position_id: VOCAL, position_name: "Vocal", quantidade: 2 },
    ];
    const t = montarTimes(dupla, []);
    expect(t[0].posicoes).toHaveLength(1);
    expect(t[0].posicoes[0].alvo).toBe(4);
  });
});

describe("escala por time · soltar o nome em cima de outro time", () => {
  const times = montarTimes(composicao, [
    linha({ id: "1", volunteer_name: "Zé", team_id: BANDA, team_name: "Vocal", position_id: VOCAL, position_name: "Vocal" }),
    linha({ id: "9", volunteer_name: "Duda", team_id: null, team_name: "Kids" }),
  ]);
  const ze = times.find((t) => t.nome === "Banda")!.posicoes[0].pessoas[0];

  it("manda o NOME do time destino — é o que o servidor casa e checa", () => {
    expect(destinoDoArraste(ze, times, INTEG)).toEqual({ team_name: "Integração" });
  });

  it("⚠️ MUTATION GUARD · soltar no PRÓPRIO time não chama servidor (mesmo com `team_name` sendo a posição)", () => {
    expect(destinoDoArraste(ze, times, BANDA)).toBeNull();
  });

  it("time sem identidade (`n:`) ou chave desconhecida não é destino", () => {
    expect(destinoDoArraste(ze, times, "n:Kids")).toBeNull();
    expect(destinoDoArraste(ze, times, "t-nao-existe")).toBeNull();
  });
});

describe("escala por time · a barra acompanha o carrossel", () => {
  it("⚠️ MUTATION GUARD · o chip do time aberto vai pro CENTRO da barra", () => {
    // chip em x=600, largura 100, tela 400 ⇒ centro do chip (650) − meia tela (200) = 450
    expect(xParaCentralizar(600, 100, 400)).toBe(450);
  });
  it("nunca rola pra trás do começo: o primeiro chip fica encostado à esquerda", () => {
    expect(xParaCentralizar(16, 120, 400)).toBe(0);
  });
});

describe("semanaDoCulto · a semana do mês no fuso da casa", () => {
  it("27/09 é o 4º domingo; 06/09 é o 1º", () => {
    expect(semanaDoCulto("2026-09-27T12:30:00Z")).toBe(4);
    expect(semanaDoCulto("2026-09-06T12:30:00Z")).toBe(1);
  });
  it("a 5ª ocorrência vira 1ª (decisão do Matheus: repete o 1º)", () => {
    expect(semanaDoCulto("2026-08-30T11:30:00Z")).toBe(1);
  });
  it("conta o dia em Brasília, não em UTC: 04/10 02:30Z ainda é 03/10 à noite", () => {
    expect(semanaDoCulto("2026-10-04T02:30:00Z")).toBe(1);
    expect(semanaDoCulto("2026-10-04T12:30:00Z")).toBe(1);
  });
  it("sem data ou data inválida → null", () => {
    expect(semanaDoCulto(null)).toBeNull();
    expect(semanaDoCulto("")).toBeNull();
    expect(semanaDoCulto("nao-e-data")).toBeNull();
  });
});

describe("ehDomingo", () => {
  it("domingo 27/09 sim; quarta 30/09 23:00Z (20:00 BRT) não", () => {
    expect(ehDomingo("2026-09-27T12:30:00Z")).toBe(true);
    expect(ehDomingo("2026-09-30T23:00:00Z")).toBe(false);
  });
  it("00:30Z de segunda ainda é domingo 21:30 em Brasília", () => {
    expect(ehDomingo("2026-09-28T00:30:00Z")).toBe(true);
  });
  it("sem data → false", () => {
    expect(ehDomingo(null)).toBe(false);
  });
});

describe("filtrarPool · filtra pelo nome mantendo a ordem do servidor", () => {
  const pool = [
    { id: "c", full_name: "Caio" },
    { id: "e", full_name: "Édu Lima" },
    { id: "a", full_name: "Ana" },
  ];
  it("busca vazia devolve a mesma lista, na mesma ordem", () => {
    expect(filtrarPool(pool, "")).toBe(pool);
    expect(filtrarPool(pool, "   ").map(p => p.id)).toEqual(["c", "e", "a"]);
  });
  it("sem acento e sem caixa: 'edu' acha 'Édu Lima'", () => {
    expect(filtrarPool(pool, "edu").map(p => p.id)).toEqual(["e"]);
    expect(filtrarPool(pool, "LIMA").map(p => p.id)).toEqual(["e"]);
  });
  it("preserva a ordem (a preferência) entre os que sobram", () => {
    expect(filtrarPool(pool, "a").map(p => p.id)).toEqual(["c", "e", "a"]);
  });
});

describe("dividirPorVaga · quem é da vaga primeiro, resto do time depois", () => {
  const SAX = "p-sax"; const VOCAL = "p-vocal";
  const pool = [
    { id: "a", full_name: "Ana", posicoes: [{ id: VOCAL, name: "Vocal" }] },
    { id: "b", full_name: "Bia", posicoes: [{ id: SAX, name: "Sax" }] },
    { id: "c", full_name: "Caio", posicoes: [] },
    { id: "d", full_name: "Dora", posicoes: [{ id: SAX, name: "Sax" }, { id: VOCAL, name: "Vocal" }] },
  ];
  it("casa pelo id da vaga e preserva a ordem dentro de cada metade", () => {
    const r = dividirPorVaga(pool, { id: SAX, nome: "Sax" });
    expect(r.daVaga.map(p => p.id)).toEqual(["b", "d"]);
    expect(r.resto.map(p => p.id)).toEqual(["a", "c"]);
  });
  it("sem id casa pelo nome, sem acento e sem caixa", () => {
    const r = dividirPorVaga(pool, { id: null, nome: "VOCAL" });
    expect(r.daVaga.map(p => p.id)).toEqual(["a", "d"]);
  });
  it("sem vaga não separa nada — tudo em resto, na ordem", () => {
    expect(dividirPorVaga(pool, null).resto.map(p => p.id)).toEqual(["a", "b", "c", "d"]);
    expect(dividirPorVaga(pool, { id: null, nome: "" }).daVaga).toEqual([]);
  });
  it("ninguém do time com a função: daVaga vazio, ninguém somiu", () => {
    const r = dividirPorVaga(pool, { id: "p-bateria", nome: "Bateria" });
    expect(r.daVaga).toEqual([]);
    expect(r.resto.length).toBe(4);
  });
  it("pessoa sem `posicoes` (servidor antigo) cai no resto", () => {
    const r = dividirPorVaga<{ id: string; full_name: string; posicoes?: { id: string; name: string | null }[] }>([{ id: "x", full_name: "X" }], { id: SAX, nome: "Sax" });
    expect(r.resto.length).toBe(1);
  });
});
