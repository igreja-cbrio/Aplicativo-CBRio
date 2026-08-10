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
import { fichaCompleta, faltaNaFicha, podeInscrever, jaTemNaFicha } from "@/lib/ficha";
import { montarPayloadInscricao, extrasFaltando } from "@/lib/inscricaoPayload";
import { tipoDaCapa, arquivoDaCapa, capaCabe, MAX_CAPA_BYTES } from "@/lib/capaGrupo";
import { motivoDaFalhaPush, mensagemDoErro } from "@/lib/motivoPush";
import { lotesDePush, tokenMorreu, MAX_POR_REQUEST } from "@/lib/pushLotes";
import { motivoDaFalha, podeVirarConteudo, ler } from "@/lib/falhaDeLeitura";
import { estadoDoQr, podeDesenharQr, temCpf } from "@/lib/cartaoQr";
import {
  estadoDoEncontro, ultimaOcorrencia, proximaOcorrencia,
  dataLonga, quandoCurto, distanciaEmTexto,
} from "@/lib/proximoEncontro";
import { navegacoes } from "./stubs/expo-router";
import { topicoVoluntariado, canaisObsoletos } from "@/lib/canalRealtime";
import {
  mascararTelefoneBR, digitosTelefone, exibirTelefone, limiteDigitos,
} from "@/lib/telefone";
import { rotaDoGrupo, ehSupervisao } from "@/lib/papelGrupo";
import { montarRegistroVisita } from "@/lib/visitaSupervisao";
import { folgaDoTeclado } from "@/lib/teclado";
import { compararVersoes, abaixoDoPiso } from "@/lib/versaoApp";
import {
  iniciarCadastroNativo, terminarCadastroNativo, lerCadastroNativo,
  assinarCadastroNativo,
} from "@/lib/cadastroEmAndamento";
import {
  nascimentoBRParaISO,
  isDataCalendarioBR,
  isValidDateBR,
  janelaIndisponibilidadeBR,
} from "../lib/validators";

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
      "/grupos", "/grupo-detalhe", "/grupo-membros", "/grupo-visita", "/grupo-inscricoes", "/grupo-editar",
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

// ═══════════════════════════════════════════════════════════════════════════
// proximoEncontro · quem é o HERÓI da tela de grupo
//
// O redesenho de 05/08 tem UM protagonista, e é esta régua que decide qual dos
// quatro estados ele carrega. Errar aqui não quebra o TypeScript: o líder
// simplesmente vê a mensagem errada — "faltou registrar" num grupo em dia, ou
// nada quando faltou de verdade.
//
// ⚠️ Datas de referência (conferidas): 2026-08-05 é TERÇA · 2026-08-09 é DOMINGO.
// ═══════════════════════════════════════════════════════════════════════════
describe("proximoEncontro · o estado do herói", () => {
  // ⚠️ Datas CONFERIDAS (a 1ª versão destes testes assumiu que 05/08 era terça e
  // 8 deles falharam — a régua estava certa, o calendário na minha cabeça não):
  //   2026-08-05 QUARTA · 08-08 sábado · 08-09 DOMINGO · 08-12 quarta
  //   2026-08-29 sábado · 08-31 segunda
  const QUARTA = 3;
  const DOMINGO = 0;

  it("hoje é o dia do grupo e não registrou: é PRÓXIMO (hoje), não atrasado", () => {
    // O dia ainda está acontecendo — cobrar registro às 9h da manhã seria cobrar
    // antes de o encontro existir.
    const e = estadoDoEncontro({ diaSemana: QUARTA, encontros: [], hoje: "2026-08-05" });
    expect(e.tipo).toBe("proximo");
    if (e.tipo === "proximo") {
      expect(e.dias).toBe(0);
      expect(e.data).toBe("2026-08-05");
    }
  });

  it("passou a quarta sem registro: ATRASADO com o nº de dias", () => {
    const e = estadoDoEncontro({ diaSemana: QUARTA, encontros: [], hoje: "2026-08-08" });
    expect(e.tipo).toBe("atrasado");
    if (e.tipo === "atrasado") {
      expect(e.data).toBe("2026-08-05");
      expect(e.dias).toBe(3);
    }
  });

  it("registrou a última ocorrência: REGISTRADO, com os presentes e a próxima", () => {
    const e = estadoDoEncontro({
      diaSemana: QUARTA,
      encontros: [{ data: "2026-08-05", presentes: 10 }],
      hoje: "2026-08-06",
    });
    expect(e.tipo).toBe("registrado");
    if (e.tipo === "registrado") {
      expect(e.presentes).toBe(10);
      expect(e.proxima).toBe("2026-08-12");
    }
  });

  it("a confirmação não fica pra sempre: passados os dias, volta a PRÓXIMO", () => {
    const e = estadoDoEncontro({
      diaSemana: QUARTA,
      encontros: [{ data: "2026-08-05", presentes: 10 }],
      hoje: "2026-08-09", // 4 dias depois
    });
    expect(e.tipo).toBe("proximo");
    if (e.tipo === "proximo") expect(e.data).toBe("2026-08-12");
  });

  it("registrou a quarta na QUINTA (tolerância de 1 dia) e não vira atrasado", () => {
    // Caso real do líder: o encontro é quarta, ele lança na quinta e digita a
    // data de quinta. Sem a folga, apareceria "atrasado" tendo registrado — e o
    // líder registraria de novo.
    const e = estadoDoEncontro({
      diaSemana: QUARTA,
      encontros: [{ data: "2026-08-06", presentes: 9 }],
      hoje: "2026-08-07",
    });
    expect(e.tipo).toBe("registrado");
  });

  // ⚠️ MUTATION GUARD: trocar `== null` por `!diaSemana` joga TODO grupo de
  // domingo em "sem dia definido" — 0 é falsy em JS. Mesma armadilha que já
  // derivou 58 campos errados no ERP (29/07).
  it("⚠️ DOMINGO (dia_semana = 0) NÃO é 'sem dia' — 0 é falsy em JS", () => {
    const e = estadoDoEncontro({ diaSemana: DOMINGO, encontros: [], hoje: "2026-08-09" });
    expect(e.tipo).not.toBe("sem_dia");
    expect(e.tipo).toBe("proximo");
    if (e.tipo === "proximo") expect(e.data).toBe("2026-08-09"); // o próprio domingo
    // e de outro dia da semana, o domingo passado sem registro é atraso normal
    const f = estadoDoEncontro({ diaSemana: DOMINGO, encontros: [], hoje: "2026-08-05" });
    expect(f.tipo).toBe("atrasado");
    if (f.tipo === "atrasado") expect(f.data).toBe("2026-08-02");
  });

  it("sem dia definido (grupo diário) devolve sem_dia, e não inventa data", () => {
    expect(estadoDoEncontro({ diaSemana: null, encontros: [], hoje: "2026-08-05" }).tipo).toBe("sem_dia");
    expect(estadoDoEncontro({ diaSemana: 9, encontros: [], hoje: "2026-08-05" }).tipo).toBe("sem_dia");
  });

  it("ocorrências: a última inclui hoje; a próxima NUNCA é hoje", () => {
    expect(ultimaOcorrencia("2026-08-05", QUARTA)).toBe("2026-08-05");
    expect(proximaOcorrencia("2026-08-05", QUARTA)).toBe("2026-08-12");
    expect(ultimaOcorrencia("2026-08-08", QUARTA)).toBe("2026-08-05");
  });

  it("atravessa a virada do mês sem quebrar", () => {
    const e = estadoDoEncontro({ diaSemana: 6, encontros: [], hoje: "2026-08-31" });
    expect(e.tipo).toBe("atrasado"); // o sábado 29/08
    if (e.tipo === "atrasado") expect(e.data).toBe("2026-08-29");
    expect(proximaOcorrencia("2026-08-31", 6)).toBe("2026-09-05");
  });

  it("texto do herói: data longa, quando curto e distância", () => {
    expect(dataLonga("2026-08-12")).toBe("Quarta, 12 de agosto");
    expect(quandoCurto(QUARTA, "20:00:00")).toBe("Quarta, 20h");
    expect(quandoCurto(QUARTA, "20:30:00")).toBe("Quarta, 20:30");
    expect(quandoCurto(null, null)).toBe("");
    expect(distanciaEmTexto(0)).toBe("é hoje");
    expect(distanciaEmTexto(1)).toBe("é amanhã");
    expect(distanciaEmTexto(4)).toBe("faltam 4 dias");
    expect(distanciaEmTexto(-3)).toBe("há 3 dias");
  });
});

// ── Nascimento (porta que TODO mundo atravessa pra entrar no app) ───────────
// A régua morava dentro de `completar-cadastro.tsx` e era mais fraca: aceitava
// 31/02 porque só conferia dia 1..31. A pessoa digitava, enviava, e só o
// SERVIDOR recusava — 400 seco na tela mais crítica do onboarding.
describe("nascimentoBRParaISO", () => {
  const HOJE = "2026-08-06";

  it("converte data válida", () => {
    expect(nascimentoBRParaISO("17/05/1990", HOJE)).toBe("1990-05-17");
    expect(nascimentoBRParaISO("29/02/2024", HOJE)).toBe("2024-02-29"); // bissexto
  });

  it("recusa data que não existe no calendário", () => {
    expect(nascimentoBRParaISO("31/02/1990", HOJE)).toBeNull();
    expect(nascimentoBRParaISO("31/04/1990", HOJE)).toBeNull();
    expect(nascimentoBRParaISO("29/02/2025", HOJE)).toBeNull(); // não bissexto
  });

  it("recusa nascimento no FUTURO (com hoje injetado, sem relógio da máquina)", () => {
    expect(nascimentoBRParaISO("07/08/2026", HOJE)).toBeNull();
    expect(nascimentoBRParaISO("06/08/2026", HOJE)).toBe("2026-08-06"); // hoje vale
  });

  it("recusa ano irreal e formato errado", () => {
    expect(nascimentoBRParaISO("17/05/1899", HOJE)).toBeNull();
    expect(nascimentoBRParaISO("1990-05-17", HOJE)).toBeNull();
    expect(nascimentoBRParaISO("17/5/1990", HOJE)).toBeNull();
    expect(nascimentoBRParaISO("", HOJE)).toBeNull();
  });
});

// ── Versão mínima · o piso da LOJA (Onda 3 · 07/08) ────────────────────────
// `runtimeVersion.policy = "appVersion"`: no dia em que a version subir, todo
// binário antigo para de receber OTA — medido ao vivo no manifesto
// (`1.0.0` → 200 com bundle · `1.0.1` → HTTP 204). O app CONGELA e o portão de
// OTA fica cego (só age com `isUpdatePending`). Daí em diante só a loja alcança
// o aparelho, e é este piso que avisa.
describe("versaoApp", () => {
  // ⚠️ MUTATION GUARD: comparar como TEXTO diria que "1.0.10" < "1.0.9" e o
  // piso bloquearia justamente quem está atualizado.
  it("compara por POSIÇÃO, não como texto", () => {
    expect(compararVersoes("1.0.10", "1.0.9")).toBe(1);
    expect(compararVersoes("1.0.9", "1.0.10")).toBe(-1);
    expect(compararVersoes("2.0.0", "10.0.0")).toBe(-1);
  });

  // ⚠️ O App Store Connect mostra a versão viva como "1.0" enquanto o app.json
  // diz "1.0.0" — medido em 07/08. Se isso contasse como diferente, o piso
  // bloquearia a base inteira.
  it('"1.0" e "1.0.0" são a MESMA versão', () => {
    expect(compararVersoes("1.0", "1.0.0")).toBe(0);
    expect(abaixoDoPiso("1.0", "1.0.0")).toBe(false);
  });

  it("abaixo do piso é abaixo; igual ou acima, não", () => {
    expect(abaixoDoPiso("1.0.0", "1.1.0")).toBe(true);
    expect(abaixoDoPiso("1.1.0", "1.1.0")).toBe(false);
    expect(abaixoDoPiso("1.2.0", "1.1.0")).toBe(false);
  });

  // ⚠️⚠️ MUTATION GUARD — o mais importante daqui. Trancar alguém fora do app
  // por causa de um dado que não deu pra ler é o pior desfecho possível.
  it("FAIL-OPEN: dado faltando ou ilegível NUNCA bloqueia", () => {
    expect(abaixoDoPiso(null, "1.1.0")).toBe(false);
    expect(abaixoDoPiso("1.0.0", null)).toBe(false);
    expect(abaixoDoPiso(undefined, undefined)).toBe(false);
    expect(abaixoDoPiso("", "1.1.0")).toBe(false);
    expect(abaixoDoPiso("versao-estranha", "1.1.0")).toBe(false);
    expect(abaixoDoPiso("1.0.0", "sei-la")).toBe(false);
  });
});

// ── Teclado · a folga é MEDIDA, não um número por tela (07/08) ──────────────
// Marcos, ao ler que eu ia "medir tela a tela": "você tá dizendo pra medir o
// celular das pessoas que usam? Faz de uma forma para ficar padrão."
// Ele estava certo: `keyboardVerticalOffset` exige um número POR TELA calibrado
// num aparelho — e aparelho diferente, fonte maior ou dobrável saem do calibre.
// Esta régua compara duas posições REAIS medidas em tempo de execução.
describe("folgaDoTeclado", () => {
  it("devolve exatamente a parte coberta", () => {
    // container termina em 800, teclado começa em 500 ⇒ 300 cobertos
    expect(folgaDoTeclado(800, 500)).toBe(300);
  });

  // ⚠️ MUTATION GUARD: sem o `max(0, …)` a conta dá NEGATIVO quando o container
  // termina ACIMA do teclado — e padding negativo no RN puxa o conteúdo pra
  // fora da tela. Seria trocar "campo coberto" por "campo cortado".
  it("nunca devolve negativo (container acima do teclado)", () => {
    expect(folgaDoTeclado(400, 500)).toBe(0);
    expect(folgaDoTeclado(500, 500)).toBe(0);
  });

  // É isto que torna a régua auto-corretiva: no Android que AINDA redimensiona
  // a janela, o container já termina acima do teclado ⇒ nenhuma folga extra,
  // sem somar a compensação duas vezes.
  it("teclado fechado = folga zero", () => {
    expect(folgaDoTeclado(800, null)).toBe(0);
    expect(folgaDoTeclado(800, undefined)).toBe(0);
  });

  it("medida absurda é capada na altura do teclado", () => {
    expect(folgaDoTeclado(5000, 500, 300)).toBe(300);
    expect(folgaDoTeclado(800, 500, 300)).toBe(300);
    expect(folgaDoTeclado(700, 500, 300)).toBe(200);
  });

  it("medida inválida não vira NaN no estilo", () => {
    expect(folgaDoTeclado(Number.NaN, 500)).toBe(0);
    expect(folgaDoTeclado(800, Number.POSITIVE_INFINITY)).toBe(0);
  });
});

// ── Supervisor · qual tela abre e o que o interruptor decide (07/08) ────────
// Pedido do Marcos: tela enxuta pro supervisor ("não precisa ver estudos,
// pedidos de aprovação"), com frequência + comentário da visita, e a plataforma
// entendendo que preencher = visita. Ele aprovou o interruptor "estive presente
// no encontro" pra o indicador não medir "digitou" em vez de "foi lá".
describe("papelGrupo", () => {
  // ⚠️ MUTATION GUARD: medido em 07/08, **7 dos 87 grupos ativos têm
  // `supervisor_id == lider_id`**. Se supervisor ganhasse a precedência, esses
  // líderes perderiam Pedidos, Estudos e Editar do PRÓPRIO grupo.
  it("supervisor vai pra tela enxuta; líder e coordenação, pra completa", () => {
    expect(rotaDoGrupo("supervisor")).toBe("/grupo-visita");
    expect(rotaDoGrupo("lider")).toBe("/grupo-membros");
    expect(rotaDoGrupo("admin")).toBe("/grupo-membros");
  });

  // ⚠️ MUTATION GUARD: papel ausente tem que cair na tela COMPLETA. Mandar pra
  // enxuta no escuro ESCONDERIA funcionalidade do líder — bundle novo contra
  // servidor antigo não pode tirar nada de ninguém.
  it("papel desconhecido/ausente cai na tela completa", () => {
    expect(rotaDoGrupo(null)).toBe("/grupo-membros");
    expect(rotaDoGrupo(undefined)).toBe("/grupo-membros");
    expect(rotaDoGrupo("nenhum")).toBe("/grupo-membros");
    expect(rotaDoGrupo("qualquer_coisa_nova")).toBe("/grupo-membros");
  });

  it("ehSupervisao é estrito", () => {
    expect(ehSupervisao("supervisor")).toBe(true);
    expect(ehSupervisao("lider")).toBe(false);
    expect(ehSupervisao(null)).toBe(false);
  });
});

describe("visitaSupervisao", () => {
  const HOJE = "2026-08-07";

  it("presente ⇒ grava a visita, com o comentário", () => {
    expect(montarRegistroVisita({ data: "2026-08-07", presente: true, comentario: " tudo bem ", hoje: HOJE }))
      .toEqual({ gravar: true, corpo: { data_visita: "2026-08-07", observacao: "tudo bem" } });
    // Comentário vazio não vira string vazia no banco.
    expect(montarRegistroVisita({ data: "2026-08-01", presente: true, comentario: "   ", hoje: HOJE }))
      .toEqual({ gravar: true, corpo: { data_visita: "2026-08-01", observacao: null } });
  });

  // ⚠️⚠️ MUTATION GUARD — este é o teste que dá SENTIDO ao interruptor.
  // O KPI real (`_kpi_agregar_dado`) conta a visita SEM olhar `status`, então
  // gravar linha com "não estive presente" faria o indicador voltar a medir
  // "digitou". Não gravar é o único jeito de o interruptor ter efeito.
  it("NÃO presente ⇒ NÃO grava visita nenhuma", () => {
    expect(montarRegistroVisita({ data: "2026-08-07", presente: false, comentario: "só recebi os números", hoje: HOJE }))
      .toEqual({ gravar: false });
  });

  it("recusa data futura e data malformada (espelha o servidor)", () => {
    expect(montarRegistroVisita({ data: "2026-08-08", presente: true, hoje: HOJE }))
      .toEqual({ erro: "data_futura" });
    expect(montarRegistroVisita({ data: "07/08/2026", presente: true, hoje: HOJE }))
      .toEqual({ erro: "data_invalida" });
    expect(montarRegistroVisita({ data: "", presente: true, hoje: HOJE }))
      .toEqual({ erro: "data_invalida" });
  });

  it("hoje vale (o encontro é registrado no mesmo dia)", () => {
    const r = montarRegistroVisita({ data: HOJE, presente: true, hoje: HOJE });
    expect("gravar" in r && r.gravar).toBe(true);
  });
});

// ── Telefone · o campo não tinha limite nem DDD visível ─────────────────────
// Relato do Marcos (07/08): "o telefone não tem limite de dígitos, podemos
// colocar um limite e incluir os dois primeiros em parênteses para deixar claro
// que precisa colocar DDD". Não é só estética: o Contrato de porta exige 10-11
// dígitos e o servidor recusa fora disso — a pessoa só descobria no fim.
describe("telefone", () => {
  it("mascara celular e fixo, com o DDD em parênteses", () => {
    expect(mascararTelefoneBR("21999998888")).toBe("(21) 99999-8888");
    expect(mascararTelefoneBR("2133334444")).toBe("(21) 3333-4444");
  });

  it("abre o parêntese já no 1º dígito (é o que comunica 'aqui é o DDD')", () => {
    expect(mascararTelefoneBR("")).toBe("");
    expect(mascararTelefoneBR("2")).toBe("(2");
    expect(mascararTelefoneBR("21")).toBe("(21");
    expect(mascararTelefoneBR("219")).toBe("(21) 9");
  });

  // ⚠️ MUTATION GUARD: sem o corte, o campo aceita 20 dígitos e quem recusa é o
  // servidor, lá no fim do cadastro, sem a pessoa saber por quê.
  it("TRUNCA no limite do país", () => {
    expect(mascararTelefoneBR("219999988889999")).toBe("(21) 99999-8888");
    expect(digitosTelefone("21 99999-8888 000", "55")).toBe("21999998888");
    expect(digitosTelefone("(21) 99999-8888", "55")).toBe("21999998888");
  });

  it("fora do Brasil não inventa formato, só limita", () => {
    expect(limiteDigitos("55")).toBe(11);
    expect(limiteDigitos("1")).toBe(15);
    expect(exibirTelefone("12025550143", "1")).toBe("12025550143");
  });
});

// ── Portão × cadastro nativo · a corrida que rebatia quem acabou de entrar ───
// 2º teste do Marcos: o carimbo `app_ficha_confirmada_em` FOI gravado
// (15:20:15.606, `matched_by: cpf`), mas a telemetria mostra a tela de cadastro
// abrindo às 15:20:19 — o portão perguntou o status em paralelo com o
// `completarCadastroApp` e leu `completo: false` de antes do carimbo.
describe("cadastroEmAndamento", () => {
  afterEach(() => {
    terminarCadastroNativo();
    vi.useRealTimers();
  });

  it("liga e desliga, avisando quem escuta", () => {
    const vistos: boolean[] = [];
    const parar = assinarCadastroNativo(() => vistos.push(lerCadastroNativo()));
    expect(lerCadastroNativo()).toBe(false);
    iniciarCadastroNativo();
    expect(lerCadastroNativo()).toBe(true);
    terminarCadastroNativo();
    expect(lerCadastroNativo()).toBe(false);
    parar();
    expect(vistos).toEqual([true, false]);
  });

  // ⚠️ MUTATION GUARD: sem o teto, um crash no meio do cadastro deixaria a
  // bandeira ligada pra sempre e o portão NUNCA decidiria — ou seja, alguém
  // entraria no app sem ficha. Tirar o `setTimeout` deixa isto vermelho.
  it("FAIL-CLOSED: baixa sozinha se o cadastro morrer no meio", () => {
    vi.useFakeTimers();
    iniciarCadastroNativo();
    expect(lerCadastroNativo()).toBe(true);
    vi.advanceTimersByTime(31_000);
    expect(lerCadastroNativo()).toBe(false);
  });
});

// ── Canal realtime · o tópico fixo derrubava a aba Servir ───────────────────
// Relato do Marcos em 07/08: "duas vezes quando tentei abrir a aba de servir
// apareceu o erro tente novamente". Não era rede nem 401 — era CRASH DE RENDER,
// capturado pelo Error Boundary da Onda 2. A telemetria de produção tem os 2
// eventos `render_crash`, com a mensagem literal do supabase-js:
//   "cannot add `postgres_changes` callbacks for realtime:voluntariado-<id>
//    after `subscribe()`"
// Causa: tópico FIXO + `removeChannel` assíncrono ⇒ a 2ª montagem reencontrava
// o canal ainda registrado e o `.on()` lançava dentro do `useEffect`.
describe("canalRealtime", () => {
  // ⚠️ MUTATION GUARD: voltar ao tópico fixo reintroduz o crash inteiro.
  it("dá um tópico NOVO a cada montagem", () => {
    const a = topicoVoluntariado("m1");
    const b = topicoVoluntariado("m1");
    expect(a).not.toBe(b);
    expect(a.startsWith("voluntariado-m1-")).toBe(true);
  });

  // ⚠️ MUTATION GUARD: o supabase-js prefixa os tópicos com `realtime:`.
  // Comparar sem isso não casa nada e a limpeza vira decoração — aí o tópico
  // único troca o crash por vazamento de canais.
  it("acha os canais velhos do membro, já com o prefixo do supabase", () => {
    const registrados = [
      "realtime:voluntariado-m1",          // o formato antigo, fixo
      "realtime:voluntariado-m1-1699-2",   // um do formato novo
      "realtime:voluntariado-m2-1699-1",   // outro membro
      "realtime:qualquer-outra-coisa",
    ];
    expect(canaisObsoletos(registrados, "m1")).toEqual([
      "realtime:voluntariado-m1",
      "realtime:voluntariado-m1-1699-2",
    ]);
  });

  it("não confunde com membro cujo id apenas COMEÇA igual", () => {
    expect(canaisObsoletos(["realtime:voluntariado-m10-1-1"], "m1")).toEqual([]);
  });
});

// ── Indisponibilidade do voluntário · a régua de NASCIMENTO recusava tudo ────
// Relato do Marcos em 07/08, testando no aparelho: "coloquei diversas datas
// 09/08/2026, 20/10/2026... mas sempre ele dá 'Data de início inválida'".
// Causa: `Disponibilidade.tsx` validava com `isValidDateBR`, que termina em
// `<= Date.now()` porque foi escrita pra DATA DE NASCIMENTO. As datas em que o
// voluntário não pode servir são FUTURAS por definição ⇒ nenhuma passava.
// Era a 2ª razão, independente da RLS, de a feature nunca ter gravado nada.
describe("janelaIndisponibilidadeBR", () => {
  const HOJE = "2026-08-07";

  // ⚠️ MUTATION GUARD: voltar a usar a régua de nascimento aqui derruba isto.
  it("ACEITA data futura — é o caso normal deste campo", () => {
    expect(janelaIndisponibilidadeBR("09/08/2026", "09/08/2026", HOJE)).toEqual({
      ok: true, de: "2026-08-09", ate: "2026-08-09",
    });
    expect(janelaIndisponibilidadeBR("20/10/2026", "25/10/2026", HOJE)).toEqual({
      ok: true, de: "2026-10-20", ate: "2026-10-25",
    });
    // As duas datas do relato dele, contra a régua de nascimento.
    // ⚠️ `HOJE` injetado: sem isso estas duas linhas viravam vermelhas sozinhas
    // quando o calendário passasse de 09/08/2026 — e viraram, em 10/08, com o
    // CI reprovando um código que ninguém tocou.
    expect(isValidDateBR("09/08/2026", HOJE)).toBe(false);
    expect(isValidDateBR("20/10/2026", HOJE)).toBe(false);
  });

  it("aceita hoje e janela que COMEÇOU no passado mas ainda vale", () => {
    expect(janelaIndisponibilidadeBR("07/08/2026", "07/08/2026", HOJE).ok).toBe(true);
    // Viagem que começou ontem e termina semana que vem: é o fim dela que
    // protege a escala. Cortar pelo início jogaria fora bloqueio legítimo.
    expect(janelaIndisponibilidadeBR("05/08/2026", "12/08/2026", HOJE)).toEqual({
      ok: true, de: "2026-08-05", ate: "2026-08-12",
    });
  });

  it("recusa janela que já terminou (sumiria da lista ao salvar)", () => {
    expect(janelaIndisponibilidadeBR("01/08/2026", "06/08/2026", HOJE)).toEqual({
      ok: false, erro: "janela_passada",
    });
  });

  it("recusa fim antes do início e data que não existe", () => {
    expect(janelaIndisponibilidadeBR("20/10/2026", "19/10/2026", HOJE)).toEqual({
      ok: false, erro: "fim_antes_do_inicio",
    });
    expect(janelaIndisponibilidadeBR("31/02/2026", "05/03/2026", HOJE)).toEqual({
      ok: false, erro: "de_invalida",
    });
    expect(janelaIndisponibilidadeBR("09/08/2026", "9/8/2026", HOJE)).toEqual({
      ok: false, erro: "ate_invalida",
    });
    expect(janelaIndisponibilidadeBR("", "", HOJE)).toEqual({
      ok: false, erro: "de_invalida",
    });
  });

  // ⚠️ MUTATION GUARD: as telas de NASCIMENTO não podem ter sido afrouxadas
  // junto — foi por isso que a régua foi SEPARADA em vez de relaxada.
  it("separar a régua NÃO afrouxou o nascimento", () => {
    expect(isDataCalendarioBR("09/08/2099")).toBe(true);   // existe no calendário
    expect(isValidDateBR("09/08/2099")).toBe(false);       // mas não é nascimento
    expect(nascimentoBRParaISO("09/08/2099", HOJE)).toBeNull();
    expect(isDataCalendarioBR("31/02/1990")).toBe(false);
    expect(isValidDateBR("17/05/1990")).toBe(true);
  });
});

// ── Capa do grupo · qual arquivo sobe (07/08/2026 · fecho da Onda 2) ────────
// Contexto medido antes de escrever isto: `mem_grupos.foto_url` preenchido em
// 0 de 278 linhas e bucket `grupos` com 0 objetos desde 04/06. A capa nunca
// funcionou pra ninguém — e um dos dois defeitos era esta escolha de formato.
describe("capa do grupo · o formato vem do MIME, não da URI", () => {
  it("aceita os 3 formatos que o servidor aceita", () => {
    expect(tipoDaCapa("image/jpeg", "file:///x.jpg")).toBe("image/jpeg");
    expect(tipoDaCapa("image/png", "file:///x.png")).toBe("image/png");
    expect(tipoDaCapa("image/webp", "file:///x.webp")).toBe("image/webp");
    expect(tipoDaCapa("  IMAGE/JPEG ", "file:///x.jpg")).toBe("image/jpeg");
  });

  it("⚠️ MUTATION GUARD · Android: URI `content://` NÃO tem extensão", () => {
    // A tela antiga fazia `asset.uri.split(".").pop()` e montava
    // `image/media` como Content-Type — num aparelho Android, sempre.
    const uri = "content://media/external/images/media/1000012345";
    expect(tipoDaCapa("image/jpeg", uri)).toBe("image/jpeg"); // o MIME salva
    expect(tipoDaCapa(null, uri)).toBeNull();                 // sem MIME, recusa
    expect(arquivoDaCapa({ uri, mimeType: "image/jpeg" })).toEqual({
      uri, name: "capa.jpg", type: "image/jpeg",
    });
  });

  it("cai na extensão da URI quando o picker não informa o MIME", () => {
    expect(tipoDaCapa(undefined, "file:///tmp/ImagePicker/abc.PNG")).toBe("image/png");
    expect(tipoDaCapa("", "file:///tmp/abc.jpeg?x=1")).toBe("image/jpeg");
    expect(tipoDaCapa(null, "file:///tmp/sem-extensao")).toBeNull();
    expect(tipoDaCapa(null, "file:///tmp/ponto.no.fim.")).toBeNull();
  });

  it("aceita o `image/jpg` inválido que alguns Android devolvem", () => {
    expect(tipoDaCapa("image/jpg", "content://x")).toBe("image/jpeg");
  });

  it("⚠️ MUTATION GUARD · recusa em vez de CHUTAR jpeg", () => {
    // Mentir o Content-Type guardaria um HEIC com nome de JPEG: a capa
    // apareceria quebrada no catálogo público e ninguém saberia por quê.
    expect(tipoDaCapa("image/heic", "file:///x.heic")).toBeNull();
    expect(tipoDaCapa("image/gif", "file:///x.gif")).toBeNull();
    expect(tipoDaCapa("application/pdf", "file:///x.pdf")).toBeNull();
    expect(arquivoDaCapa({ uri: "file:///x.heic", mimeType: "image/heic" })).toBeNull();
  });

  it("o nome do arquivo é NOSSO (o do aparelho pode ter acento e emoji)", () => {
    const a = arquivoDaCapa({ uri: "file:///tmp/Foto 🎉 do grupo.png", mimeType: "image/png" });
    expect(a?.name).toBe("capa.png");
  });

  it("recusa asset sem uri", () => {
    expect(arquivoDaCapa(null)).toBeNull();
    expect(arquivoDaCapa({ uri: "", mimeType: "image/jpeg" })).toBeNull();
    expect(arquivoDaCapa({ uri: "   ", mimeType: "image/jpeg" })).toBeNull();
  });

  it("⚠️ MUTATION GUARD · tamanho é FAIL-OPEN quando desconhecido", () => {
    // O `ImagePicker` nem sempre preenche `fileSize`. Recusar por dado ilegível
    // barraria envio legítimo; quem recusa de verdade é o multer, com 400.
    expect(capaCabe(undefined)).toBe(true);
    expect(capaCabe(null)).toBe(true);
    expect(capaCabe(NaN)).toBe(true);
    expect(capaCabe(0)).toBe(true);
    expect(capaCabe(1024)).toBe(true);
    expect(capaCabe(MAX_CAPA_BYTES)).toBe(true);
    expect(capaCabe(MAX_CAPA_BYTES + 1)).toBe(false);
  });
});

// ── Por que o push não registrou (07/08/2026 · fecho da Onda 2) ─────────────
// O achado: `app_push_tokens` tem 30 linhas, TODAS iOS. Zero Android, desde
// sempre, porque o binário nunca teve Firebase. O que escondeu isso por dois
// meses foi um `catch` que só fazia `console.log` — a falha não existia em
// painel nenhum. Esta régua vira a mensagem opaca do módulo nativo num enum
// que o painel CONTA; se ela classificar errado, o conserto vai ser verificado
// contra o número errado.
describe("motivoDaFalhaPush · o silêncio virou número", () => {
  it("⚠️ MUTATION GUARD · a mensagem REAL do Android sem Firebase", () => {
    // Literal de `expo-notifications/.../PushTokenModule.kt:88`.
    const real = new Error(
      "Make sure to complete the guide at https://docs.expo.dev/push-notifications/fcm-credentials/ : "
      + "Default FirebaseApp is not initialized in this process br.com.cbrio.app."
    );
    expect(motivoDaFalhaPush(real)).toBe("credencial_fcm");
  });

  it("⚠️ MUTATION GUARD · credencial ganha de permissão quando as duas palavras aparecem", () => {
    // A mensagem do Firebase interpola `e.message`, que pode conter
    // "permission". Trocar a ordem faria o achado de hoje (credencial) se
    // disfarçar de "as pessoas recusaram" — a conclusão errada mais fácil de
    // tirar de "zero token no Android", e a que levaria ao conserto errado.
    const misto = new Error("fcm-credentials : missing permission for FirebaseApp");
    expect(motivoDaFalhaPush(misto)).toBe("credencial_fcm");
  });

  it("separa permissão, simulador, rede e projectId", () => {
    expect(motivoDaFalhaPush(new Error("User denied notification permission"))).toBe("permissao");
    expect(motivoDaFalhaPush(new Error("Must be a physical device to get a push token"))).toBe("simulador");
    expect(motivoDaFalhaPush(new Error("Network request failed"))).toBe("rede");
    expect(motivoDaFalhaPush(new Error("The request timed out"))).toBe("rede");
    expect(motivoDaFalhaPush(new Error("No projectId found"))).toBe("sem_project_id");
  });

  it("cai em `outro` sem inventar causa (a mensagem crua vai junto no evento)", () => {
    expect(motivoDaFalhaPush(new Error("algo totalmente novo"))).toBe("outro");
    expect(motivoDaFalhaPush(null)).toBe("outro");
    expect(motivoDaFalhaPush(undefined)).toBe("outro");
    expect(motivoDaFalhaPush({})).toBe("outro");
    expect(motivoDaFalhaPush("")).toBe("outro");
  });

  it("aceita erro que é string (nem tudo que o RN lança é Error)", () => {
    expect(motivoDaFalhaPush("Firebase not configured")).toBe("credencial_fcm");
  });

  it("mensagemDoErro corta em 300 e nunca explode", () => {
    expect(mensagemDoErro(new Error("  oi  "))).toBe("oi");
    expect(mensagemDoErro("x".repeat(500))).toHaveLength(300);
    expect(mensagemDoErro(null)).toBe("");
    expect(mensagemDoErro(undefined)).toBe("");
    expect(mensagemDoErro({ message: 42 })).toBe("[object Object]");
  });
});

// ── Como partir o lote de push (07/08/2026) ─────────────────────────────────
// O achado: `system_mobile_push_tickets` tem 1.820 tickets, ZERO com
// `ticket_status='ok'` e 1.773 `PUSH_TOO_MANY_EXPERIENCE_IDS`. A Expo recusa o
// REQUEST INTEIRO quando tokens de projetos diferentes vão juntos — um token do
// app Staff derrubava a entrega dos 30 tokens iOS válidos do app de membros.
// Nenhuma notificação push jamais chegou a ninguém.
describe("lotesDePush · nunca misturar projeto no mesmo request", () => {
  const T = (token: string, projeto_id?: string | null) => ({ token, projeto_id });

  it("⚠️ MUTATION GUARD · projetos diferentes NUNCA no mesmo lote", () => {
    // É o bug inteiro, numa linha. Se este teste passar com a régua errada,
    // a régua não vale nada.
    const lotes = lotesDePush([T("a", "membros"), T("b", "staff"), T("c", "membros")]);
    for (const lote of lotes) {
      expect(new Set(lote.map((t) => t.projeto_id)).size).toBe(1);
    }
    expect(lotes.length).toBe(2);
  });

  it("⚠️ MUTATION GUARD · token de projeto DESCONHECIDO vai SOZINHO", () => {
    // Os 30 tokens de hoje têm projeto NULL. Agrupá-los reproduziria o bug com
    // outro nome — são justamente os de origem ambígua.
    const lotes = lotesDePush([T("a", null), T("b"), T("c", "   ")]);
    expect(lotes).toEqual([[T("a", null)], [{ token: "b" }], [T("c", "   ")]]);
    expect(lotes.every((l) => l.length === 1)).toBe(true);
  });

  it("respeita o teto de 100 por request dentro do MESMO projeto", () => {
    const muitos = Array.from({ length: 250 }, (_, i) => T(`t${i}`, "membros"));
    const lotes = lotesDePush(muitos);
    expect(lotes.map((l) => l.length)).toEqual([100, 100, 50]);
    expect(MAX_POR_REQUEST).toBe(100);
  });

  it("mistura real: conhecidos agrupados, desconhecidos um a um", () => {
    const lotes = lotesDePush([
      T("m1", "membros"), T("velho1", null), T("s1", "staff"),
      T("m2", "membros"), T("velho2", null),
    ]);
    // 1 lote de membros (2) + 1 de staff (1) + 2 sozinhos = 4
    expect(lotes.length).toBe(4);
    expect(lotes[0].map((t) => t.token)).toEqual(["m1", "m2"]);
    expect(lotes[1].map((t) => t.token)).toEqual(["s1"]);
    expect(lotes.slice(2).every((l) => l.length === 1)).toBe(true);
  });

  it("deduplica por token (o mesmo aparelho não recebe 2 notificações)", () => {
    const lotes = lotesDePush([T("a", "m"), T("a", "m"), T(" a ", "m"), T("b", "m")]);
    expect(lotes).toEqual([[T("a", "m"), T("b", "m")]]);
  });

  it("ignora token vazio e entrada degenerada sem explodir", () => {
    expect(lotesDePush([])).toEqual([]);
    expect(lotesDePush(null)).toEqual([]);
    expect(lotesDePush(undefined)).toEqual([]);
    expect(lotesDePush([T(""), T("   ")])).toEqual([]);
    expect(lotesDePush([T("a", "m")], 0)).toEqual([[T("a", "m")]]);
  });

  it("é determinístico na ordem (projetos ordenados)", () => {
    const a = lotesDePush([T("x", "zeta"), T("y", "alfa")]);
    const b = lotesDePush([T("y", "alfa"), T("x", "zeta")]);
    expect(a).toEqual(b);
    expect(a[0][0].projeto_id).toBe("alfa");
  });
});

describe("tokenMorreu · só apaga o que é realmente permanente", () => {
  it("⚠️ MUTATION GUARD · NÃO apaga por erro de LOTE", () => {
    // Apagar por `PUSH_TOO_MANY_EXPERIENCE_IDS` teria zerado a tabela: 1.773
    // tickets com esse código, e a culpa era do request, não do token. 30
    // pessoas perderiam push por um defeito que não era delas.
    expect(tokenMorreu("PUSH_TOO_MANY_EXPERIENCE_IDS")).toBe(false);
    expect(tokenMorreu("MessageRateExceeded")).toBe(false);
    expect(tokenMorreu("MessageTooBig")).toBe(false);
    expect(tokenMorreu("HTTP_500")).toBe(false);
    expect(tokenMorreu("NETWORK_ERROR")).toBe(false);
    expect(tokenMorreu(null)).toBe(false);
    expect(tokenMorreu(undefined)).toBe(false);
    expect(tokenMorreu("")).toBe(false);
  });

  it("apaga o token de app desinstalado", () => {
    expect(tokenMorreu("DeviceNotRegistered")).toBe(true);
    expect(tokenMorreu("  DeviceNotRegistered  ")).toBe(true);
  });
});

// ── "Não sei" ≠ "Não" (07/08/2026 · Onda 4) ────────────────────────────────
// O defeito: catches espalhados devolviam o valor VAZIO como se fosse resposta
// do servidor. Erro de rede virava AFIRMAÇÃO FALSA — "inscrições fechadas",
// "você não está inscrito em nada", o líder sem o botão de gerenciar. Cada um
// foi escrito como "fail-closed, mais seguro", e é mesmo — para PERMISSÃO.
// Nenhum deles é permissão: são LEITURAS DE ESTADO, onde fail-closed não
// protege nada, só mente.
describe("motivoDaFalha · separa o que não deu pra perguntar", () => {
  const comStatus = (s: number) => Object.assign(new Error("x"), { status: s });

  it("⚠️ MUTATION GUARD · erro SEM status é conexão, não resposta", () => {
    // É o caso mais comum no celular (sem sinal, DNS, timeout do fetch) e o
    // mais importante de não confundir com "o servidor disse não".
    expect(motivoDaFalha(new Error("Network request failed"))).toBe("conexao");
    expect(motivoDaFalha(new Error("timeout"))).toBe("conexao");
    expect(motivoDaFalha(null)).toBe("conexao");
    expect(motivoDaFalha(undefined)).toBe("conexao");
    expect(motivoDaFalha({})).toBe("conexao");
    expect(motivoDaFalha(Object.assign(new Error("x"), { status: "429" }))).toBe("conexao");
  });

  it("separa cota, sessão e servidor", () => {
    expect(motivoDaFalha(comStatus(429))).toBe("limite");
    expect(motivoDaFalha(comStatus(401))).toBe("sessao");
    expect(motivoDaFalha(comStatus(403))).toBe("sessao");
    expect(motivoDaFalha(comStatus(500))).toBe("servidor");
    expect(motivoDaFalha(comStatus(502))).toBe("servidor");
    expect(motivoDaFalha(comStatus(400))).toBe("servidor");
  });

  it("⚠️ MUTATION GUARD · NENHUMA falha pode virar conteúdo", () => {
    // A regra inteira numa linha. Se algum dia isto devolver true pra qualquer
    // motivo, volta a mentira que a Onda 4 tirou do app.
    for (const m of ["conexao", "limite", "sessao", "servidor"] as const) {
      expect(podeVirarConteudo(m)).toBe(false);
    }
  });

  it("ler() nunca lança e embrulha os dois lados", async () => {
    await expect(ler(Promise.resolve(42))).resolves.toEqual({ ok: true, valor: 42 });
    await expect(ler(Promise.reject(comStatus(429)))).resolves.toEqual({ ok: false, motivo: "limite" });
    await expect(ler(Promise.reject(new Error("off")))).resolves.toEqual({ ok: false, motivo: "conexao" });
  });
});

// ── QR do cartão: três estados, uma frase (10/08/2026 · Onda B) ─────────────
// Apontamento 13 do Marcos: "o QR code do membro não está aparecendo, ele diz
// 'QR code não disponível'". Medido: 26 das 54 contas do app com cadastro NÃO
// têm CPF — e sem CPF não existe QR possível (ele mapeia token → CPF). A tela
// dava a MESMA frase pra 3 estados e nenhum dizia o que fazer. E o pior: a
// chamada descartava o erro, então timeout virava "indisponível".
describe("estadoDoQr · não confundir 'não sei' com 'não tem'", () => {
  const OK = { token: "abc123", membroId: "m1", cpf: "12345678901", falhou: false };

  it("com token, desenha", () => {
    expect(estadoDoQr(OK)).toBe("ok");
    expect(podeDesenharQr("ok")).toBe(true);
  });

  it("⚠️ MUTATION GUARD · erro vem ANTES de tudo", () => {
    // Se a ordem inverter, quem teve timeout é mandado completar um cadastro
    // que já está certo. Mesma lei do lib/falhaDeLeitura.ts.
    expect(estadoDoQr({ ...OK, token: null, falhou: true })).toBe("erro");
    expect(estadoDoQr({ token: null, membroId: null, cpf: null, falhou: true })).toBe("erro");
    expect(estadoDoQr({ ...OK, cpf: null, falhou: true })).toBe("erro");
  });

  it("sem vínculo e sem CPF são estados DIFERENTES (caminhos diferentes)", () => {
    expect(estadoDoQr({ token: null, membroId: null, cpf: null, falhou: false })).toBe("sem_vinculo");
    expect(estadoDoQr({ token: null, membroId: "m1", cpf: null, falhou: false })).toBe("sem_cpf");
    expect(estadoDoQr({ token: null, membroId: "m1", cpf: "123", falhou: false })).toBe("sem_cpf");
  });

  it("vinculado, com CPF, sem token e sem erro → trata como erro, não inventa", () => {
    expect(estadoDoQr({ token: null, membroId: "m1", cpf: "12345678901", falhou: false })).toBe("erro");
    expect(estadoDoQr({ token: "   ", membroId: "m1", cpf: "12345678901", falhou: false })).toBe("erro");
  });

  it("⚠️ MUTATION GUARD · nunca desenha QR fora do estado `ok`", () => {
    // `react-native-qrcode-svg` com value vazio desenha um quadrado preto sem
    // sentido em vez de falhar — e QR ilegível no leitor da recepção é pior que
    // a ausência dele.
    for (const e of ["sem_vinculo", "sem_cpf", "erro"] as const) {
      expect(podeDesenharQr(e)).toBe(false);
    }
  });

  it("temCpf exige 11 dígitos, ignorando máscara", () => {
    expect(temCpf("123.456.789-01")).toBe(true);
    expect(temCpf("12345678901")).toBe(true);
    expect(temCpf("1234567890")).toBe(false);
    expect(temCpf(null)).toBe(false);
    expect(temCpf("")).toBe(false);
  });
});

// ── A ficha não deve ser reperguntada (10/08/2026 · apontamento 4) ──────────
// Marcos: "no batismo ele pediu data de nascimento, sendo que supostamente já
// tem no sistema, deveria ter apenas o pedido do tamanho da camisa". A tela
// tinha o dado em `useMembro()` e mostrava o campo de qualquer jeito.
describe("jaTemNaFicha · só pergunta o que falta", () => {
  const COMPLETO = {
    nome: "Marcos Paulo", telefone: "21999998888", email: "m@cbrio.org",
    cpf: "12345678901", dataNascimento: "1990-05-17", genero: "masculino",
  };

  it("com a ficha completa, não pergunta nada do padrão", () => {
    for (const c of ["nome", "telefone", "email", "cpf", "dataNascimento", "genero"] as const) {
      expect(jaTemNaFicha(COMPLETO, c)).toBe(true);
    }
  });

  it("pergunta só o campo que falta", () => {
    expect(jaTemNaFicha({ ...COMPLETO, dataNascimento: null }, "dataNascimento")).toBe(false);
    expect(jaTemNaFicha({ ...COMPLETO, dataNascimento: null }, "nome")).toBe(true);
    expect(jaTemNaFicha({ ...COMPLETO, genero: null }, "genero")).toBe(false);
  });

  it("⚠️ MUTATION GUARD · usa a MESMA validação de faltaNaFicha, não `!!campo`", () => {
    // Telefone de 8 dígitos e CPF de 9 estão "preenchidos" e o servidor RECUSA.
    // Um `!!campo` diria que já tem, a tela não perguntaria, e a pessoa levaria
    // 400 no fim do formulário — que é o defeito que o CPF já causou em 50 das
    // 75 contas em 05/08.
    expect(jaTemNaFicha({ ...COMPLETO, telefone: "99998888" }, "telefone")).toBe(false);
    expect(jaTemNaFicha({ ...COMPLETO, cpf: "123456789" }, "cpf")).toBe(false);
    // Nome sem sobrenome também é reprovado pelo contrato.
    expect(jaTemNaFicha({ ...COMPLETO, nome: "Marcos" }, "nome")).toBe(false);
  });

  it("sem membro, pergunta tudo", () => {
    for (const c of ["nome", "telefone", "email", "cpf", "dataNascimento", "genero"] as const) {
      expect(jaTemNaFicha(null, c)).toBe(false);
      expect(jaTemNaFicha(undefined, c)).toBe(false);
    }
  });
});
