import { describe, it, expect } from "vitest";
import {
  visivel, faltando, blocosVisiveis, progresso, limparInvisiveis,
  alternarOpcao, ehNeutra, NAO_SE_APLICA, type Pergunta,
} from "../lib/censoForm";
import { tiposNaoSuportados, TIPOS_SUPORTADOS } from "../lib/censoApi";

// Estas regras são CÓPIA LITERAL do formulário da web. O que está em teste aqui
// é a paridade: se o app decidir diferente do site o que aparece, o que falta ou
// quanto foi respondido, a pessoa é barrada por uma pergunta que nunca viu — ou
// envia o censo com buraco.

const Q: Pergunta[] = [
  { id: "b1", tipo: "secao", texto: "1 — Identificação" },
  { id: "nome", tipo: "texto_curto", texto: "Nome", obrigatoria: true },
  { id: "b2", tipo: "secao", texto: "2 — Família" },
  { id: "tem_filhos", tipo: "sim_nao", texto: "Tem filhos?", obrigatoria: true },
  {
    id: "quantos", tipo: "numero", texto: "Quantos?", obrigatoria: true,
    mostrar_se: { pergunta: "tem_filhos", valores: ["Sim"] },
  },
];

describe("condicional", () => {
  it("pergunta condicional só aparece quando a resposta casa", () => {
    expect(visivel(Q[4], {})).toBe(false);
    expect(visivel(Q[4], { tem_filhos: "Não" })).toBe(false);
    expect(visivel(Q[4], { tem_filhos: "Sim" })).toBe(true);
  });

  it("⚠️ obrigatória INVISÍVEL não é cobrada — senão o formulário trava sem explicar", () => {
    const semFilhos = { nome: "Ana", tem_filhos: "Não" };
    expect(faltando(Q, semFilhos)).toEqual([]);

    const comFilhos = { nome: "Ana", tem_filhos: "Sim" };
    expect(faltando(Q, comFilhos).map((p) => p.id)).toEqual(["quantos"]);
  });

  it("bloco sem pergunta visível DESAPARECE — é o que encurta o formulário", () => {
    // Com "Não", o bloco 2 fica só com a pergunta sim/não (a condicional sai).
    const b = blocosVisiveis(Q, { tem_filhos: "Não" });
    expect(b.map((x) => x.titulo)).toEqual(["1 — Identificação", "2 — Família"]);
    expect(b[1].perguntas.map((p) => p.id)).toEqual(["tem_filhos"]);
  });

  it("progresso conta só as VISÍVEIS", () => {
    expect(progresso(Q, { tem_filhos: "Não" })).toEqual({ feitas: 1, total: 2, pct: 50 });
    expect(progresso(Q, { tem_filhos: "Sim" })).toEqual({ feitas: 1, total: 3, pct: 33 });
  });

  it("⚠️ limparInvisiveis tira resposta órfã depois de a pessoa voltar e mudar", () => {
    // Respondeu 3 filhos, voltou e disse que não tem: o 3 não pode ir no envio.
    const sujo = { nome: "Ana", tem_filhos: "Não", quantos: 3 };
    expect(limparInvisiveis(Q, sujo)).toEqual({ nome: "Ana", tem_filhos: "Não" });
  });
});

describe("opção neutra é exclusiva", () => {
  const p: Pergunta = {
    id: "x", tipo: "multipla", texto: "Onde?",
    opcoes: ["Culto", "Grupo", "Prefiro não dizer"],
    opcoes_neutras: ["Prefiro não dizer"],
  };

  it("marcar a neutra limpa as outras", () => {
    expect(alternarOpcao(p, ["Culto", "Grupo"], "Prefiro não dizer")).toEqual(["Prefiro não dizer"]);
  });

  it("marcar outra remove a neutra", () => {
    expect(alternarOpcao(p, ["Prefiro não dizer"], "Culto")).toEqual(["Culto"]);
  });

  it("desmarcar funciona nos dois casos", () => {
    expect(alternarOpcao(p, ["Culto"], "Culto")).toEqual([]);
    expect(alternarOpcao(p, ["Prefiro não dizer"], "Prefiro não dizer")).toEqual([]);
  });

  it("'Não se aplica' conta como neutra quando a pergunta permite", () => {
    expect(ehNeutra({ ...p, permite_nao_se_aplica: true }, NAO_SE_APLICA)).toBe(true);
    expect(ehNeutra(p, NAO_SE_APLICA)).toBe(false);
  });
});

describe("guarda de tipo não suportado", () => {
  it("⚠️ tipo que o app não renderiza é DENUNCIADO, não ignorado", () => {
    // Ignorar faria a pessoa enviar o censo sem responder uma pergunta que
    // existe, e o gráfico dela ficaria vazio sem ninguém entender por quê.
    // `busca` É suportado (o questionário real tem 2 dessas — igreja e grupo —
    // e sem elas o formulário nativo não serviria para este censo).
    const comBusca: Pergunta[] = [...Q, { id: "igreja", tipo: "busca", texto: "Qual igreja?" }];
    expect(tiposNaoSuportados(comBusca)).toEqual([]);

    // Um tipo que ainda não existe: é este caso que tem que mandar para a web.
    const comFuturo: Pergunta[] = [...Q, { id: "foto", tipo: "arquivo", texto: "Envie uma foto" }];
    expect(tiposNaoSuportados(comFuturo)).toEqual(["arquivo"]);
    expect(tiposNaoSuportados(Q)).toEqual([]);
  });

  it("todo tipo do questionário de exemplo é suportado", () => {
    for (const p of Q) expect(TIPOS_SUPORTADOS.has(p.tipo)).toBe(true);
  });
});
