// ============================================================================
// CI DAS RÉGUAS DO APP — o portão que não existia (05/08/2026)
//
// Cada bloco aqui existe por causa de uma divergência REAL entre app e ERP,
// achada na varredura de 05/08 e medida em produção. O comentário de cada um diz
// qual era o estrago — porque teste sem o "por quê" é o primeiro a ser apagado
// quando incomoda.
//
// ⚠️ MUTATION GUARD: os testes marcados assim falham se alguém "simplificar" a
// régua de volta pro jeito errado. É o que faz o teste valer.
// ============================================================================
import { describe, expect, it, vi, afterEach } from "vitest";
import { estadoVoluntariado, volEncerrado } from "@/lib/volStatus";
import { rotaPai, ehRaiz, subirUmNivel } from "@/lib/hierarquia";
import { hojeBRT, diaBRT } from "@/lib/dataBRT";
import { fichaCompleta, faltaNaFicha, podeInscrever } from "@/lib/ficha";
import { montarPayloadInscricao, extrasFaltando } from "@/lib/inscricaoPayload";
import { navegacoes } from "./stubs/expo-router";

// ─────────────────────────────────────────────────────────────────────────────
// 1 · VOLUNTARIADO · o ERP tem 7 status; o app tratava 3
// Medido em 05/08: integrado 575 · inscrito 80 · enviado_ministerio 68 ·
// nao_responde 69 · nao_pode_ou_duplicata 19 · kids 3. As 91 últimas caíam em
// lugar nenhum: o hub dizia "Pendente" e a tela mostrava o FORMULÁRIO.
// ─────────────────────────────────────────────────────────────────────────────
describe("volStatus · os 7 status do ERP", () => {
  it("integrado e kids são ATIVO (kids = alocada no ministério Kids)", () => {
    expect(estadoVoluntariado("integrado")).toBe("ativo");
    expect(estadoVoluntariado("kids")).toBe("ativo");
  });

  it("inscrito e enviado_ministerio são PENDENTE (a fila da equipe segue com a pessoa)", () => {
    expect(estadoVoluntariado("inscrito")).toBe("pendente");
    expect(estadoVoluntariado("enviado_ministerio")).toBe("pendente");
  });

  // ⚠️ MUTATION GUARD: era aqui que 88 pessoas viam "Pendente" pra sempre.
  it("status ENCERRADO pela equipe NÃO é pendente — é nenhum (pode se inscrever de novo)", () => {
    for (const s of ["nao_responde", "nao_pode_ou_duplicata", "desistente"]) {
      expect(estadoVoluntariado(s), `${s} não pode virar pendente`).toBe("nenhum");
      expect(volEncerrado(s)).toBe(true);
    }
  });

  // ⚠️ MUTATION GUARD: status novo no ERP não pode virar "pendente" por acidente
  // (fila que ninguém trata). O certo é deixar a pessoa agir.
  it("status DESCONHECIDO cai em nenhum, nunca em pendente", () => {
    expect(estadoVoluntariado("status_que_o_erp_criou_amanha")).toBe("nenhum");
    expect(estadoVoluntariado(null)).toBe("nenhum");
    expect(estadoVoluntariado(undefined)).toBe("nenhum");
    expect(estadoVoluntariado("")).toBe("nenhum");
  });

  it("a flag mem_membros.voluntario vence (voluntário antigo, sem inscrição)", () => {
    expect(estadoVoluntariado(null, true)).toBe("ativo");
    expect(estadoVoluntariado("nao_responde", true)).toBe("ativo");
  });

  it("volEncerrado só é true pros terminais", () => {
    expect(volEncerrado("integrado")).toBe(false);
    expect(volEncerrado("inscrito")).toBe(false);
    expect(volEncerrado(null)).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2 · NAVEGAÇÃO · a seta é `cd ..`, e o botão físico do Android é a MESMA árvore
// ─────────────────────────────────────────────────────────────────────────────
describe("hierarquia · a árvore do `cd ..`", () => {
  afterEach(() => {
    navegacoes.length = 0;
  });

  it("tela de barra volta pra Home em UM passo", () => {
    for (const r of ["/meu-grupo", "/voluntariado", "/cuidados", "/devocional", "/menu"]) {
      expect(rotaPai(r), `${r} deveria subir pra Home`).toBe("/");
    }
  });

  it("tela de profundidade volta pro PAI, não pra Home", () => {
    expect(rotaPai("/trocar-senha")).toBe("/configuracoes");
    expect(rotaPai("/cartoes")).toBe("/perfil");
    expect(rotaPai("/kids-filho")).toBe("/kids");
    expect(rotaPai("/evento")).toBe("/inscricoes");
    expect(rotaPai("/next-turma")).toBe("/next");
  });

  it("query string não muda o pai (deep link com ?id= tem que subir igual)", () => {
    expect(rotaPai("/grupo-detalhe?id=abc-123")).toBe("/meu-grupo");
    expect(rotaPai("/evento?id=xyz")).toBe("/inscricoes");
  });

  it("rota fora do mapa cai na Home (destino previsível, não adivinhação)", () => {
    expect(rotaPai("/tela-que-alguem-criou-e-nao-mapeou")).toBe("/");
  });

  it("a raiz é raiz (a Home não tem seta, e o back físico não é interceptado lá)", () => {
    expect(ehRaiz("/")).toBe(true);
    expect(ehRaiz("/?x=1")).toBe(true);
    expect(ehRaiz("/menu")).toBe(false);
  });

  // ⚠️ INVARIANTE DA ÁRVORE: todo pai citado tem que ser a Home ou existir como
  // rota mapeada. Sem isto, uma tela nova mal mapeada leva a seta pra um pai
  // que não sobe pra lugar nenhum — e a pessoa fica presa a 2 toques da Home.
  it("todo pai é alcançável (a Home ou outra rota do mapa)", () => {
    const rotas = [
      "/meu-grupo", "/voluntariado", "/cuidados", "/devocional", "/menu",
      "/grupos", "/grupo-detalhe", "/grupo-membros", "/grupo-inscricoes", "/grupo-editar",
      "/escala-supervisor", "/anotacoes", "/perfil", "/cartoes", "/familia", "/kids",
      "/kids-filho", "/kids-solicitar-vinculo", "/jornada", "/generosidade",
      "/comprovante-doacoes", "/inscricoes", "/batismo", "/inscricao-batismo", "/next",
      "/next-turma", "/evento", "/videos", "/configuracoes", "/trocar-senha",
      "/fale-conosco", "/sobre", "/notificacoes", "/mural", "/modo-culto", "/culto-detalhe",
    ];
    for (const r of rotas) {
      const pai = rotaPai(r);
      const paiSobeMais = pai === "/" || rotas.includes(pai);
      expect(paiSobeMais, `o pai de ${r} é ${pai}, que não está na árvore`).toBe(true);
    }
  });

  it("subirUmNivel navega pro pai (é o que a seta e o botão físico chamam)", () => {
    subirUmNivel("/trocar-senha");
    expect(navegacoes).toEqual(["/configuracoes"]);
  });

  // ⚠️ MUTATION GUARD: se alguém trocar `navigate` por `back()`, isto quebra —
  // e `back()` é justamente o comportamento de histórico que o Marcos pediu pra
  // abandonar ("que esse voltar fosse um comando cd .. no terminal").
  it("NÃO usa histórico: da tela de barra vai direto pra Home", () => {
    subirUmNivel("/devocional");
    expect(navegacoes).toEqual(["/"]);
    expect(navegacoes).not.toContain("(back)");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3 · DIA DA IGREJA · BRT, não UTC
// O culto de quarta é 20h; com `toISOString()` o dia UTC vira às 21h BRT e o
// culto saía da lista de "próximos" DURANTE o próprio culto.
// ─────────────────────────────────────────────────────────────────────────────
describe("dataBRT · o dia de operação da igreja", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  // ⚠️ MUTATION GUARD do fuso: relógio fixo, não o do computador de quem roda.
  it("21h no Rio ainda é HOJE (em UTC já seria amanhã)", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-05T23:30:00.000Z")); // 20:30 BRT do dia 5
    expect(hojeBRT()).toBe("2026-08-05");
    vi.setSystemTime(new Date("2026-08-06T02:00:00.000Z")); // 23:00 BRT do dia 5
    expect(hojeBRT()).toBe("2026-08-05");
  });

  it("depois da meia-noite BRT vira o dia seguinte", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-06T03:30:00.000Z")); // 00:30 BRT do dia 6
    expect(hojeBRT()).toBe("2026-08-06");
  });

  it("diaBRT anda pra frente e pra trás", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-05T15:00:00.000Z")); // 12h BRT
    expect(diaBRT(0)).toBe("2026-08-05");
    expect(diaBRT(7)).toBe("2026-08-12");
    expect(diaBRT(-1)).toBe("2026-08-04");
  });

  it("atravessa a virada do mês", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-31T20:00:00.000Z")); // 17h BRT de 31/08
    expect(diaBRT(1)).toBe("2026-09-01");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4 · FICHA · o que as inscrições não repetem, e o que o servidor exige
// O CPF barrava 50 das 75 contas do app na hora de pedir grupo — o app deixava
// tentar e o servidor recusava com 400.
// ─────────────────────────────────────────────────────────────────────────────
describe("ficha · o contrato do lado do app", () => {
  const completo = {
    nome: "Maria Aparecida Souza",
    telefone: "21999998888",
    email: "maria@exemplo.com",
    cpf: "12345678901",
    dataNascimento: "1990-04-12",
    genero: "feminino",
  };

  it("fichaCompleta exige nome COM sobrenome + telefone + e-mail", () => {
    expect(fichaCompleta(completo)).toBe(true);
    expect(fichaCompleta({ ...completo, nome: "Maria" })).toBe(false);
    expect(fichaCompleta({ ...completo, telefone: "" })).toBe(false);
    expect(fichaCompleta({ ...completo, email: "" })).toBe(false);
    expect(fichaCompleta(null)).toBe(false);
  });

  it("ficha completa pode inscrever", () => {
    expect(podeInscrever(completo)).toBe(true);
    expect(faltaNaFicha(completo)).toEqual([]);
  });

  // ⚠️ MUTATION GUARD: afrouxar isto faz a pessoa preencher o formulário inteiro
  // pra levar 400 do servidor (que exige os 6 por padrão).
  it("aponta cada campo que o servidor vai exigir", () => {
    expect(faltaNaFicha({ ...completo, cpf: null })).toContain("CPF");
    expect(faltaNaFicha({ ...completo, cpf: "1234567890" })).toContain("CPF"); // 10 dígitos
    expect(faltaNaFicha({ ...completo, genero: null })).toContain("sexo");
    expect(faltaNaFicha({ ...completo, dataNascimento: null })).toContain("data de nascimento");
    expect(faltaNaFicha({ ...completo, telefone: "99999" })).toContain("telefone");
    expect(faltaNaFicha(null)).toHaveLength(6);
  });

  it("CPF e telefone com máscara contam como preenchidos", () => {
    expect(podeInscrever({ ...completo, cpf: "123.456.789-01", telefone: "(21) 99999-8888" })).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5 · PAYLOAD · o corpo que vai pro servidor
// ─────────────────────────────────────────────────────────────────────────────
describe("inscricaoPayload · o corpo da inscrição", () => {
  const membro = {
    nome: "  João Pedro Lima ",
    telefone: "(21) 98888-7777",
    email: " joao@exemplo.com ",
    cpf: "123.456.789-01",
    dataNascimento: "1985-11-30",
    genero: "masculino",
  };

  // ⚠️ MUTATION GUARD: esta é a lista que o servidor exige. Tirar um campo aqui
  // não quebra o TypeScript — quebra a inscrição da pessoa, com 400.
  it("manda TODOS os campos do contrato", () => {
    const p = montarPayloadInscricao(membro);
    for (const k of [
      "nome_completo", "telefone", "cpf", "email", "data_nascimento", "sexo",
      "dados", "aceita_termos", "whatsapp_optin",
    ]) {
      expect(p, `faltou ${k} no payload`).toHaveProperty(k);
    }
    expect(p.sexo).toBe("masculino");
    expect(p.aceita_termos).toBe(true);
  });

  it("normaliza como o servidor espera (digits-only, trim)", () => {
    const p = montarPayloadInscricao(membro);
    expect(p.telefone).toBe("21988887777");
    expect(p.cpf).toBe("12345678901");
    expect(p.nome_completo).toBe("João Pedro Lima");
    expect(p.email).toBe("joao@exemplo.com");
  });

  it("campo extra em branco NÃO vira resposta vazia", () => {
    const p = montarPayloadInscricao(membro, { ministerio: "Louvor", obs: "   " });
    expect(p.dados).toEqual({ ministerio: "Louvor" });
  });

  it("opt-in de WhatsApp é explícito e default false (D4)", () => {
    expect(montarPayloadInscricao(membro).whatsapp_optin).toBe(false);
    expect(montarPayloadInscricao(membro, {}, true).whatsapp_optin).toBe(true);
  });

  it("extrasFaltando aponta o obrigatório em branco, e só ele", () => {
    const campos = [
      { key: "a", label: "Ministério", obrigatorio: true },
      { key: "b", label: "Observação" },
    ];
    expect(extrasFaltando(campos, {})).toBe("Ministério");
    expect(extrasFaltando(campos, { a: "Louvor" })).toBeNull();
    expect(extrasFaltando(null, {})).toBeNull();
  });
});
