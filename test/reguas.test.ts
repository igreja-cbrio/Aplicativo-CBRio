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
import { acaoDaBarra, ehRotaDeBarra, irParaBarra, ROTAS_BARRA } from "@/lib/nav";
import { hojeBRT, diaBRT } from "@/lib/dataBRT";
import { decidirServe } from "@/lib/serveJornada";
import { diaDoInstanteBRT, ehDiaDoCulto, cultosDeHoje } from "@/lib/janelaCheckin";
import { ehFormato } from "../scripts/i18n-cobertura.mjs";
import { fichaCompleta, faltaNaFicha, podeInscrever, jaTemNaFicha } from "@/lib/ficha";
import { montarPayloadInscricao, extrasFaltando } from "@/lib/inscricaoPayload";
import { tipoDaCapa, arquivoDaCapa, capaCabe, MAX_CAPA_BYTES } from "@/lib/capaGrupo";
import { motivoDaFalhaPush, mensagemDoErro } from "@/lib/motivoPush";
import { lotesDePush, tokenMorreu, MAX_POR_REQUEST } from "@/lib/pushLotes";
import { ALERTAS_QUE_FICAM_NATIVOS } from "@/lib/dialogosNativos";
import { semComentarios } from "../scripts/semComentarios.mjs";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { motivoDaFalha, podeVirarConteudo, ler } from "@/lib/falhaDeLeitura";
import { estadoDoQr, podeDesenharQr, temCpf } from "@/lib/cartaoQr";
import { linkDeInscricao, ehPorConvite, precisaEscolherNaLista } from "@/lib/convite";
import { acaoAoFechar, temRascunho } from "@/lib/descartarRascunho";
import { casaBusca, normalizarBusca, filtrarPorTexto } from "@/lib/buscaTexto";
import { ehDomingo, indiceDoDestaque } from "@/lib/homeCultos";
import { escalaPendeResposta, resumoEscalas } from "@/lib/resumoEscalas";
import { carteiraDe, motivoFalhaCarteira } from "@/lib/carteira";
import { OPCOES_PORTA, opcaoPorTipo, podeEnviar, ehDaPortaUnica } from "@/lib/portaUnica";
import { normalizarVoluntariadoMe } from "@/lib/voluntariadoMe";
import {
  CAMPOS_DA_CRIANCA,
  avisoDoVinculo,
  faltaNoPedido,
  nascimentoParaISO,
  podeEnviarPedido,
  cpfPareceValido,
  outroEmBranco,
  VAZIO_OUTRO,
} from "@/lib/apresentacaoCrianca";
import {
  estadoDoEncontro, ultimaOcorrencia, proximaOcorrencia,
  dataLonga, quandoCurto, distanciaEmTexto, dataComHora, horaCurta,
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
import { quebrarAposPrimeiraPalavra } from "../lib/rotuloAtalho";
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

  it("⚠⚠ MUTATION GUARD · quem ESTÁ SERVINDO não precisa de inscrição", () => {
    // O caso do Pedro Fernandes (Marcos · 11/08/2026): escalado em ~89 cultos,
    // ZERO linha em `vol_inscricoes`, e a tela de Servir oferecia a ele "quero
    // ser voluntário". Esta régua sempre esteve CERTA — o furo era o servidor
    // nunca mandar `true` (resolvia o perfil por `vol_profiles.auth_user_id`,
    // preenchido em 20 de 928). Exigir status aqui quebraria o Pedro de novo.
    expect(estadoVoluntariado(null, true)).toBe("ativo");
    expect(estadoVoluntariado(undefined, true)).toBe("ativo");
    // Serve HOJE ganha de fila encerrada no passado: a equipe encerrou uma
    // inscrição antiga, mas ele está na escala do próximo domingo.
    expect(estadoVoluntariado("nao_responde", true)).toBe("ativo");
    expect(estadoVoluntariado("desistente", true)).toBe("ativo");
  });

  it("⚠️ não serve e não se inscreveu ⇒ formulário (não 'pendente')", () => {
    // Fila que ninguém está tratando é pior que oferecer o formulário: quem vê
    // "pendente" espera, e ninguém vem.
    for (const flag of [false, null, undefined]) {
      expect(estadoVoluntariado(null, flag)).toBe("nenhum");
    }
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
// 2b · O TOQUE NA BARRA DE BAIXO (11/08/2026 · "a navegação tá travada")
// A régua é curta e a guarda é uma só, mas é a que importa: `replace` aqui
// destruiria a aba a cada toque, e voltar pra ela pagaria montagem nova + a
// busca do `useFocusEffect` + o spinner. `navigate` volta pra instância VIVA,
// com a rolagem e o que já tinha carregado.
// ─────────────────────────────────────────────────────────────────────────────
describe("barra de baixo · reaproveita a aba viva", () => {
  afterEach(() => {
    navegacoes.length = 0;
  });

  // ⚠️⚠️ MUTATION GUARD: trocar por `replace` "pra não empilhar" é a otimização
  // de boa-fé que faz a aba recarregar do zero toda vez.
  it("NUNCA usa replace (destruiria a aba e forçaria recarga a cada troca)", () => {
    irParaBarra("/meu-grupo", "/voluntariado");
    expect(navegacoes).toEqual(["/voluntariado"]);
    expect(navegacoes.some((n) => n.startsWith("(replace)"))).toBe(false);
  });

  it("da Home e de tela de profundidade também é navigate", () => {
    expect(acaoDaBarra("/", "/menu")).toBe("ir");
    expect(acaoDaBarra("/grupo-detalhe", "/meu-grupo")).toBe("ir");
    irParaBarra("/cartoes", "/menu");
    expect(navegacoes).toEqual(["/menu"]);
  });

  it("toque no item já aceso não navega", () => {
    // ⚠️ As 4 abas de DESTINO: tocar na aba acesa não faz nada. Jogar pra Home
    // seria perder a tela por um toque acidental.
    for (const r of ["/meu-grupo", "/voluntariado", "/cuidados", "/devocional"]) {
      expect(acaoDaBarra(r, r)).toBe("nada");
      irParaBarra(r, r);
    }
    expect(navegacoes).toEqual([]);
  });

  // ⚠️⚠️ MUDANÇA DE COMPORTAMENTO (20/08/2026 · pedido do Matheus): este teste
  // dizia que `/menu` → `/menu` era "nada". O menu é uma GAVETA e a Home NÃO
  // está na barra, então de dentro dele não havia caminho de 1 toque de volta.
  it("tocar em Menu estando no menu volta pra Home", () => {
    expect(acaoDaBarra("/menu", "/menu")).toBe("home");
    irParaBarra("/menu", "/menu");
    expect(navegacoes).toEqual(["/"]);
  });

  it("a volta pra Home é navigate, nunca replace (reaproveita a Home da pilha)", () => {
    irParaBarra("/menu", "/menu");
    expect(navegacoes.some((n) => n.startsWith("(replace)"))).toBe(false);
  });

  it("query string não muda a decisão (deep link com ?aba= é a mesma tela)", () => {
    // /menu?x=1 continua sendo /menu — logo, volta pra Home também.
    expect(acaoDaBarra("/menu?x=1", "/menu")).toBe("home");
    expect(acaoDaBarra("/meu-grupo?aba=encontrar", "/cuidados")).toBe("ir");
    expect(acaoDaBarra("/cuidados?x=1", "/cuidados")).toBe("nada");
  });

  it("as 5 rotas da barra são as mesmas que a barra desenha", () => {
    expect([...ROTAS_BARRA]).toEqual(["/meu-grupo", "/voluntariado", "/cuidados", "/devocional", "/menu"]);
    for (const r of ROTAS_BARRA) expect(ehRotaDeBarra(r)).toBe(true);
    expect(ehRotaDeBarra("/")).toBe(false);
    expect(ehRotaDeBarra("/grupo-detalhe")).toBe(false);
  });
});

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
// ehFormato · MÁSCARA não é texto traduzível (26/08/2026)
//
// ⚠️ O portão de i18n conta "strings soltas" (texto em português fora do `t()`).
// Máscara de data é FORMATO, não texto — traduzir `dd/mm/aaaa` quebraria a
// máscara. O `ehFormato` isentava só a versão em MAIÚSCULA (`DD/MM/AAAA`), e a
// tela de completar-cadastro usa minúscula: o teto de soltas estourou por causa
// dela e **`npm run ota` passou a recusar publicar**. Este teste guarda as duas
// pontas: o que DEVE ser isento e o que NÃO pode ser.
// ─────────────────────────────────────────────────────────────────────────────
describe("ehFormato · máscara é isenta, prosa não", () => {
  it("isenta máscara de data e hora, em maiúscula e minúscula", () => {
    expect(ehFormato("DD/MM/AAAA")).toBe(true);
    expect(ehFormato("dd/mm/aaaa")).toBe(true);
    expect(ehFormato("mm/yy")).toBe(true);
    expect(ehFormato("dd-mm-aaaa")).toBe(true);
    expect(ehFormato("HH:MM")).toBe(true);
  });

  // ⚠️ MISTURAR CAIXA não é isento — e é assim de propósito. `"HH:mm"` não casa
  // nem na classe maiúscula (não tem `m`) nem na minúscula (não tem `H`). Eu
  // cheguei a achar que era um furo, mas conferi: essa máscara NÃO EXISTE no app
  // hoje. Alargar a classe pra aceitar caixa mista sem necessidade medida
  // deixaria prosa curta como "as.mas" sair da contagem em silêncio.
  it("máscara de caixa MISTA não é isenta (não existe no app; não alargar sem medir)", () => {
    expect(ehFormato("HH:mm")).toBe(false);
  });

  // ⚠️⚠️ O RISCO DE ABRIR DEMAIS. A variante em maiúscula aceita ESPAÇO como
  // separador; se a de minúscula aceitasse, prosa curta feita só de `a`, `h`,
  // `d`, `m`, `s` e espaço sairia da contagem EM SILÊNCIO — e guarda que
  // esconde o problema é pior que guarda nenhuma.
  it("NÃO isenta prosa que por acaso só tem letras de máscara", () => {
    expect(ehFormato("ah ah")).toBe(false);
    expect(ehFormato("sim sim")).toBe(false);
    expect(ehFormato("ada mas")).toBe(false);
  });

  it("NÃO isenta texto de verdade", () => {
    expect(ehFormato("Data de nascimento")).toBe(false);
    expect(ehFormato("Salvar")).toBe(false);
    expect(ehFormato("CPF")).toBe(false);      // curto demais, e é rótulo
  });

  it("string curta nunca é formato", () => {
    expect(ehFormato("dd")).toBe(false);
    expect(ehFormato("")).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// JANELA DO CHECK-IN PELO SUPERVISOR · o dia do culto, em BRT (25/08/2026)
//
// O supervisor faz check-in dos voluntários da área dele pelo app, só nos dias
// de culto (pedido do Matheus · pra a igreja não ficar refém de um único ponto
// de check-in). O servidor decide o MESMO em `backend/utils/janelaCulto.js` e
// responde 403 fora da janela — se o app calcular diferente, o botão aparece e
// o toque falha, que é pior que o botão não aparecer.
//
// ⚠️⚠️ Culto de domingo 19h é 22h UTC. Das 21h BRT o UTC já virou o dia
// seguinte, então `toISOString().slice(0,10)` FECHA A JANELA NO MEIO DO CULTO DA
// NOITE — quando o supervisor está justamente batendo os check-ins.
// ─────────────────────────────────────────────────────────────────────────────
describe("janelaCheckin · o dia do culto em BRT", () => {
  const DOMINGO_19H = "2026-08-23T22:00:00.000Z"; // 19h BRT de domingo 23/08

  it("diaDoInstanteBRT devolve a data LOCAL, não a UTC", () => {
    expect(diaDoInstanteBRT(DOMINGO_19H)).toBe("2026-08-23");
    // 22h30 BRT do domingo já é 01h30 UTC de segunda.
    expect(diaDoInstanteBRT("2026-08-24T01:30:00.000Z")).toBe("2026-08-23");
    // 23h BRT do sábado é 02h UTC do domingo.
    expect(diaDoInstanteBRT("2026-08-23T02:00:00.000Z")).toBe("2026-08-22");
  });

  it("não inventa data pra entrada inválida", () => {
    expect(diaDoInstanteBRT(null)).toBeNull();
    expect(diaDoInstanteBRT("")).toBeNull();
    expect(diaDoInstanteBRT("nao-e-data")).toBeNull();
  });

  // ⚠️⚠️ O CASO QUE MOTIVOU A RÉGUA: culto da NOITE, supervisor batendo ponto às
  // 21h30 BRT. Em UTC já é segunda; a janela tem que continuar ABERTA.
  it("21h30 BRT do domingo: janela do culto das 19h continua ABERTA", () => {
    expect(ehDiaDoCulto(DOMINGO_19H, new Date("2026-08-24T00:30:00.000Z")).ok).toBe(true);
    expect(ehDiaDoCulto(DOMINGO_19H, new Date("2026-08-24T02:59:00.000Z")).ok).toBe(true);
  });

  it("00h01 BRT de segunda já fechou", () => {
    const r = ehDiaDoCulto(DOMINGO_19H, new Date("2026-08-24T03:01:00.000Z"));
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.motivo).toBe("fora_do_dia");
  });

  it("dia INTEIRO: abre antes do culto e não fecha depois dele", () => {
    const manha = "2026-08-23T11:30:00.000Z"; // 08h30 BRT
    expect(ehDiaDoCulto(manha, new Date("2026-08-23T09:00:00.000Z")).ok).toBe(true); // 06h BRT
    expect(ehDiaDoCulto(manha, new Date("2026-08-24T01:00:00.000Z")).ok).toBe(true); // 22h BRT
    expect(ehDiaDoCulto(manha, new Date("2026-08-22T20:00:00.000Z")).ok).toBe(false); // véspera
  });

  it("sem data é distinguível de fora do dia (a tela diz coisas diferentes)", () => {
    const r = ehDiaDoCulto(null, new Date(DOMINGO_19H));
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.motivo).toBe("sem_data");
  });

  it("cultosDeHoje só deixa passar os de hoje", () => {
    const servicos = [
      { id: "a", scheduled_at: DOMINGO_19H },
      { id: "b", scheduled_at: "2026-08-23T11:30:00.000Z" },
      { id: "c", scheduled_at: "2026-08-26T23:00:00.000Z" }, // quarta
      { id: "d", scheduled_at: null },
    ];
    const hoje = cultosDeHoje(servicos, new Date("2026-08-24T00:30:00.000Z")); // 21h30 BRT dom
    expect(hoje.map((s) => s.id)).toEqual(["a", "b"]);
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

// ── Data E HORA na prévia (10/08/2026 · o que o Marcos pediu de verdade) ────
// A prévia dos encontros usava `formatRelativo`, que devolve "Em 5 dias" — nem
// data, nem hora. O pedido era o oposto: "eu nem consegui ver a data nem nada".
// "Em 5 dias" não responde "que dia é?" nem "que hora é?", que é o que a pessoa
// precisa pra decidir se consegue ir.
describe("dataComHora · responde 'que dia' E 'que hora'", () => {
  it("junta data longa e hora", () => {
    expect(dataComHora("2026-08-20", "19:30")).toBe("Quinta, 20 de agosto · 19:30");
    expect(dataComHora("2026-08-20", "20:00")).toBe("Quinta, 20 de agosto · 20h");
  });

  it("aceita o `time` do Postgres (com segundos)", () => {
    expect(dataComHora("2026-08-20", "19:30:00")).toBe("Quinta, 20 de agosto · 19:30");
    expect(dataComHora("2026-08-20", "20:00:00")).toBe("Quinta, 20 de agosto · 20h");
  });

  it("⚠️ MUTATION GUARD · sem hora, NÃO inventa meia-noite", () => {
    // `NextEncontro.horario` é opcional. Um "00:00" soaria como meia-noite e
    // faria a pessoa achar que o encontro é de madrugada.
    for (const h of [null, undefined, "", "   "]) {
      expect(dataComHora("2026-08-20", h)).toBe("Quinta, 20 de agosto");
    }
  });

  it("⚠️ MUTATION GUARD · o resultado NUNCA é relativo", () => {
    // Se alguém trocar de volta por `formatRelativo`, isto reprova: o texto tem
    // que carregar o DIA e o MÊS, não "Em N dias".
    const txt = dataComHora("2026-08-20", "19:30");
    expect(txt).toContain("20");
    expect(txt).toContain("agosto");
    expect(txt).not.toMatch(/dias|Hoje|Amanhã/);
  });

  it("horaCurta ignora hora inválida em vez de imprimir NaN", () => {
    expect(horaCurta("abc")).toBe("");
    expect(horaCurta(null)).toBe("");
    expect(horaCurta("19:30")).toBe("19:30");
    expect(horaCurta("07:00")).toBe("7h");
  });
});

// ── O link que o líder compartilha (10/08/2026 · apontamento 2) ─────────────
// "tem como colocar o link de inscrição daquele grupo específico, não do link
// geral". Já era possível — o comentário no código dizia o contrário, e isso
// impediu o conserto: conferido em produção, `?grupo=<id>` responde 200.
// ⚠️ Mas 9 dos 102 grupos ativos são "por convite do líder" e o backend responde
// 403 a link neles — mandar o link específico recusaria todo mundo.
describe("linkDeInscricao · o grupo certo, sem quebrar os por convite", () => {
  const NORMAL = { id: "abc-123", modo_inscricao: "temporada" };
  const SEMPRE = { id: "abc-123", modo_inscricao: "sempre_aberto" };
  const CONVITE = { id: "abc-123", modo_inscricao: "fechado" };

  it("grupo normal ganha link DIRETO", () => {
    expect(linkDeInscricao(NORMAL)).toBe("https://www.cbrio.org/inscricao-grupos?grupo=abc-123");
    expect(linkDeInscricao(SEMPRE)).toBe("https://www.cbrio.org/inscricao-grupos?grupo=abc-123");
  });

  it("⚠️⚠️ grupo POR CONVITE também ganha link direto (Marcos · 11/08)", () => {
    // Este teste travava o CONTRÁRIO até 10/08 — eu mandava o link geral porque
    // o backend recusava 'fechado' com 403. Era justamente o caso em que o líder
    // MAIS precisa do link: "por convite do líder" só existe se o líder puder
    // convidar. Palavras dele: "libera o link direto para os grupos por convite
    // também, mesmo fechados. eles não devem ser achados na lista de grupos
    // públicos, mas se o líder quiser convidar alguém, deve poder."
    // O backend liberou junto (publicGrupos.js + utils/entradaGrupoApp.js).
    expect(linkDeInscricao(CONVITE)).toBe("https://www.cbrio.org/inscricao-grupos?grupo=abc-123");
    // `ehPorConvite` continua dizendo a verdade sobre o grupo — ela só não
    // decide mais o link.
    expect(ehPorConvite(CONVITE)).toBe(true);
    expect(ehPorConvite(NORMAL)).toBe(false);
  });

  it("sem id, link geral (não monta `?grupo=` vazio)", () => {
    expect(linkDeInscricao({ id: null, modo_inscricao: "temporada" }))
      .toBe("https://www.cbrio.org/inscricao-grupos");
    expect(linkDeInscricao(null)).toBe("https://www.cbrio.org/inscricao-grupos");
    expect(linkDeInscricao({ id: "  ", modo_inscricao: "temporada" }))
      .toBe("https://www.cbrio.org/inscricao-grupos");
  });

  it("⚠️ MUTATION GUARD · o TEXTO acompanha o link", () => {
    // Trocar o link sem trocar o texto é o pior desfecho: mandaria procurar na
    // lista um grupo já pré-selecionado, ou entrar direto num link que cai na
    // lista geral. Agora só quem NÃO tem id cai no geral.
    expect(precisaEscolherNaLista(NORMAL)).toBe(false);
    expect(precisaEscolherNaLista(CONVITE)).toBe(false);
    expect(precisaEscolherNaLista(null)).toBe(true);
    expect(precisaEscolherNaLista({ id: null, modo_inscricao: "temporada" })).toBe(true);
  });

  it("usa www (o apex responde 307) e escapa o id", () => {
    expect(linkDeInscricao(NORMAL)).toContain("https://www.cbrio.org");
    expect(linkDeInscricao({ id: "a b", modo_inscricao: "temporada" })).toContain("a%20b");
  });
});

// ── Não perca o que já foi digitado (10/08/2026 · apontamento 15) ───────────
// "ao clicar fora ele apenas sai sem perguntar... vi isso tentando registrar a
// frequência". ⚠️ A causa não é o toque fora — é o BOTÃO VOLTAR do Android
// (`onRequestClose`); estes modais não fecham por backdrop. O efeito é o mesmo:
// a chamada inteira some com um toque errado.
describe("acaoAoFechar · só pergunta quando há trabalho a perder", () => {
  it("modal vazio fecha DIRETO", () => {
    expect(acaoAoFechar({})).toBe("fechar");
    expect(acaoAoFechar({ campos: ["", null, undefined] })).toBe("fechar");
    expect(acaoAoFechar({ campos: [], mudouAlgo: false })).toBe("fechar");
  });

  it("⚠️ MUTATION GUARD · espaço em branco NÃO é rascunho", () => {
    // Um toque acidental na barra de espaço não deve passar a exigir
    // confirmação pra sair de todo modal.
    expect(acaoAoFechar({ campos: ["   ", "\n"] })).toBe("fechar");
    expect(temRascunho(["  "])).toBe(false);
  });

  it("texto digitado pergunta", () => {
    expect(acaoAoFechar({ campos: ["oi"] })).toBe("perguntar");
    expect(acaoAoFechar({ campos: ["", "comentário do líder"] })).toBe("perguntar");
  });

  it("⚠️ MUTATION GUARD · `mudouAlgo` cobre o trabalho SEM texto", () => {
    // A queixa veio da tela de frequência, onde o trabalho é a chamada inteira
    // e pode não haver uma letra digitada. Só olhar os campos perderia o caso.
    expect(acaoAoFechar({ campos: ["", ""], mudouAlgo: true })).toBe("perguntar");
    expect(temRascunho([], true)).toBe(true);
  });

  it("⚠️⚠️ MUTATION GUARD · SALVANDO não fecha e não pergunta", () => {
    // Fechar no meio do envio deixa a pessoa sem saber se gravou — e ela tenta
    // de novo, duplicando a chamada. É o único desfecho aqui que gera dado sujo.
    expect(acaoAoFechar({ campos: ["oi"], salvando: true })).toBe("aguardar");
    expect(acaoAoFechar({ campos: [], salvando: true })).toBe("aguardar");
    expect(acaoAoFechar({ mudouAlgo: true, salvando: true })).toBe("aguardar");
  });
});

// ── Busca por nome, sem acento (10/08/2026 · apontamento 1) ────────────────
// A chamada ganhou busca porque o roster vai até 57 pessoas. ⚠️ Ignorar acento
// não é enfeite: quem digita no meio do encontro escreve "joao", não "João" — o
// teclado nem oferece o til sem segurar a tecla. Busca sensível a acento não
// acha metade dos nomes brasileiros, e a pessoa conclui que o nome não está no
// grupo. A régua estava presa dentro de um .tsx (não rodava no portão).
describe("busca sem acento · acha o nome como a pessoa digita", () => {
  it("⚠️ MUTATION GUARD · 'joao' acha 'João'", () => {
    expect(casaBusca("João da Silva", "joao")).toBe(true);
    expect(casaBusca("JOSÉ Antônio", "jose")).toBe(true);
    expect(casaBusca("Maria Conceição", "conceicao")).toBe(true);
    expect(casaBusca("Ângela", "angela")).toBe(true);
  });

  it("o contrário também: com acento acha sem", () => {
    expect(casaBusca("Joao sem acento", "joão")).toBe(true);
  });

  it("busca por SUBSTRING, não só prefixo (gente procura por sobrenome)", () => {
    expect(casaBusca("Marcos Paulo Almeida", "almeida")).toBe(true);
    expect(casaBusca("Marcos Paulo Almeida", "paulo")).toBe(true);
  });

  it("⚠️ MUTATION GUARD · termo VAZIO casa com tudo", () => {
    // É o estado inicial do campo: a lista tem que aparecer inteira antes de a
    // pessoa digitar. Se isto virar `false`, a chamada abre vazia.
    for (const v of ["", "   ", null, undefined]) {
      expect(casaBusca("qualquer nome", v)).toBe(true);
    }
  });

  it("não casa o que não tem", () => {
    expect(casaBusca("João da Silva", "pedro")).toBe(false);
    expect(casaBusca(null, "pedro")).toBe(false);
  });

  it("filtrarPorTexto devolve a lista ORIGINAL quando não há termo", () => {
    const lista = [{ nome: "Ana" }, { nome: "Bruno" }];
    expect(filtrarPorTexto(lista, "", (x) => x.nome)).toBe(lista); // mesma referência
    expect(filtrarPorTexto(lista, "an", (x) => x.nome)).toEqual([{ nome: "Ana" }]);
    expect(filtrarPorTexto(lista, "zzz", (x) => x.nome)).toEqual([]);
  });

  it("normalizarBusca aguenta entrada degenerada", () => {
    expect(normalizarBusca(null)).toBe("");
    expect(normalizarBusca(undefined)).toBe("");
    expect(normalizarBusca("  MARIA  ")).toBe("maria");
  });
});

// ── Quem fica em cima na Home (11/08/2026 · apontamento 9, 3ª rodada) ──────
// "o culto de domingo tem muitos horários e fica feio pois ele passa. Coloque o
// culto de domingo sempre em cima." Antes o destaque era o PRÓXIMO culto, então
// ele trocava de lugar ao longo da semana e remontava o bloco.
describe("indiceDoDestaque · o domingo é âncora", () => {
  // 2026-08-16 é domingo; 2026-08-12 é quarta.
  const QUARTA = { data: "2026-08-12" };
  const DOMINGO = { data: "2026-08-16" };
  const SABADO = { data: "2026-08-15" };

  it("⚠️ MUTATION GUARD · o domingo sobe mesmo não sendo o primeiro", () => {
    expect(indiceDoDestaque([QUARTA, SABADO, DOMINGO])).toBe(2);
    expect(indiceDoDestaque([DOMINGO, QUARTA])).toBe(0);
  });

  it("sem domingo na lista, o primeiro (que é o próximo — a lista vem ordenada)", () => {
    expect(indiceDoDestaque([QUARTA, SABADO])).toBe(0);
  });

  it("lista vazia devolve -1 (a Home não renderiza destaque nenhum)", () => {
    expect(indiceDoDestaque([])).toBe(-1);
    expect(indiceDoDestaque(null)).toBe(-1);
    expect(indiceDoDestaque(undefined)).toBe(-1);
  });

  it("⚠️⚠️ MUTATION GUARD · domingo é lido no fuso do BRASIL, não em UTC", () => {
    // `new Date("2026-08-16")` é UTC no JS e, em UTC-3, volta como SÁBADO 21h —
    // o domingo simplesmente não seria reconhecido e o destaque nunca ancorava.
    expect(ehDomingo("2026-08-16")).toBe(true);
    expect(ehDomingo("2026-08-15")).toBe(false);
    expect(ehDomingo("2026-08-17")).toBe(false);
    // com hora junto (como vem de alguns payloads) o corte tem que funcionar
    expect(ehDomingo("2026-08-16T19:30:00Z")).toBe(true);
  });

  it("data inválida não vira domingo por acidente", () => {
    for (const v of ["", "  ", "16/08/2026", "abc", null, undefined]) {
      expect(ehDomingo(v)).toBe(false);
    }
  });
});

// ── A porta única de falar com a igreja (11/08/2026 · apontamento 14) ───────
// Decisão do Marcos: "vamos separar em duas portas então, uma que é esse contato
// SOS, que tem que ser destacado como é hoje, e a outra é o fale com a CBRio: ao
// clicar, você teria 3 opções — marcar conversa com pastor, pedir oração, e a
// terceira opção de enviar mensagem de dúvida, sugestão, pedido ou feedback."
describe("porta única · 3 opções, e o SOS fora dela", () => {
  it("⚠️⚠️ MUTATION GUARD · o SOS NÃO é item desta porta", () => {
    // É a única destas portas que pode salvar alguém em minuto zero: tem tela
    // própria e oferece CVV 188 ANTES de qualquer formulário. Virar item de
    // lista somaria dois toques entre a pessoa e o socorro.
    expect(ehDaPortaUnica("sos")).toBe(false);
    expect(opcaoPorTipo("sos")).toBeNull();
    expect(OPCOES_PORTA.some((o) => (o.tipo as string) === "sos")).toBe(false);
  });

  it("são exatamente as 3 que ele pediu, na ordem que ele pediu", () => {
    expect(OPCOES_PORTA.map((o) => o.tipo)).toEqual(["aconselhamento", "oracao", "contato"]);
  });

  it("⚠️ MUTATION GUARD · os 3 tipos JÁ EXISTIAM (nenhuma categoria nova)", () => {
    // Tipo novo exigiria mexer na fila do Cuidados, no filtro do ERP e na
    // análise por IA. Inventar categoria aqui criaria um TERCEIRO vocabulário
    // pra "o que você precisa" — `conversas_setores` e `cui_pedidos` já têm o
    // deles.
    for (const o of OPCOES_PORTA) {
      expect(["aconselhamento", "oracao", "contato"]).toContain(o.tipo);
    }
  });

  it("⚠️ MUTATION GUARD · conversa com pastor NÃO exige texto", () => {
    // Quem procura um pastor muitas vezes não sabe (ou não quer) escrever o
    // motivo num campo. Exigir texto criaria barreira onde não havia — hoje é
    // um botão só.
    expect(podeEnviar("aconselhamento", "")).toBe(true);
    expect(podeEnviar("aconselhamento", null)).toBe(true);
  });

  it("oração e dúvida exigem texto — e espaço não conta", () => {
    expect(podeEnviar("oracao", "")).toBe(false);
    expect(podeEnviar("oracao", "   ")).toBe(false);
    expect(podeEnviar("oracao", "ore pela minha mãe")).toBe(true);
    expect(podeEnviar("contato", "  ")).toBe(false);
    expect(podeEnviar("contato", "sugestão")).toBe(true);
  });

  it("tipo de fora da porta nunca envia", () => {
    for (const v of ["sos", "grupos", "batismo", "", null, undefined]) {
      expect(podeEnviar(v, "texto qualquer")).toBe(false);
    }
  });
});

// ── /app/voluntariado/me · o campo que chegava errado em silêncio (11/08) ───
// Marcos: "Pedro Fernandes, escalado em todos os cultos, ao entrar em servir
// apareceu o pedido de quero ser voluntário." Ele tem 57 escalas e ZERO
// inscrição — e `voluntario_ativo` vinha de `mem_membros.voluntario`, coluna
// `true` em 0 de 4.072 membros. A tela nunca perguntou ao servidor.
describe("resposta de /voluntariado/me · normalização", () => {
  it("⚠️⚠️ MUTATION GUARD · sem o campo, NÃO inventa que a pessoa é voluntária", () => {
    // Erra pro lado seguro em quem não sabemos…
    expect(normalizarVoluntariadoMe({ inscricao: null }).voluntario_ativo).toBe(false);
    expect(normalizarVoluntariadoMe({}).voluntario_ativo).toBe(false);
    expect(normalizarVoluntariadoMe(null).voluntario_ativo).toBe(false);
  });

  it("⚠️⚠️ MUTATION GUARD · quem o servidor diz que serve, SERVE", () => {
    // …e nunca pro lado de negar quem serve: era esse o defeito relatado.
    // Trocar `=== true` por um truthy frouxo faria a string "false" passar;
    // trocar por `!!` mantém isto verde mas quebra o teste da string abaixo.
    expect(normalizarVoluntariadoMe({ voluntario_ativo: true }).voluntario_ativo).toBe(true);
    // Serve HOJE, sem inscrição nenhuma — o caso do Pedro.
    const me = normalizarVoluntariadoMe({ voluntario_ativo: true, inscricao: null });
    expect(estadoVoluntariado(me.inscricao?.status, me.voluntario_ativo)).toBe("ativo");
  });

  it("⚠️ string não é booleano: \"false\" do servidor não vira true", () => {
    for (const v of ["false", "true", 1, 0, "", "sim", {}]) {
      expect(normalizarVoluntariadoMe({ voluntario_ativo: v }).voluntario_ativo).toBe(false);
    }
  });

  it("aceita envelope { data } e objeto cru", () => {
    expect(normalizarVoluntariadoMe({ data: { voluntario_ativo: true } }).voluntario_ativo).toBe(true);
    expect(normalizarVoluntariadoMe({ voluntario_ativo: true }).voluntario_ativo).toBe(true);
  });

  it("⚠️ inscrição sem status vira null (não objeto meio-preenchido)", () => {
    // Com `status: undefined` a régua leria "" e responderia "nenhum" — diria
    // que a pessoa nunca se inscreveu tendo ela inscrição na fila.
    expect(normalizarVoluntariadoMe({ inscricao: { id: "x" } }).inscricao).toBeNull();
    expect(normalizarVoluntariadoMe({ inscricao: { id: "x", status: "  " } }).inscricao).toBeNull();
    const ok = normalizarVoluntariadoMe({ inscricao: { id: "x", status: "inscrito" } });
    expect(ok.inscricao?.status).toBe("inscrito");
    expect(estadoVoluntariado(ok.inscricao?.status, ok.voluntario_ativo)).toBe("pendente");
  });
});

// ── Apresentação de criança · "sem CPF, identificamos pelo pai" (11/08) ─────
// Marcos: "quando cadastrar uma criança deve gerar pessoa no sistema que aparece
// em minha família, com as regras de criança, sem CPF, identificamos pelo pai."
describe("apresentação de criança · a régua da tela", () => {
  const CRI = { nome: "Ana Clara", nascimento: "10/03/2025", sexo: "F" as const };
  const RESP = { nome: "Joana Souza", telefone: "(21) 99999-1111", email: "" };

  it("⚠️⚠️ MUTATION GUARD · o formulário NÃO tem campo de CPF", () => {
    // A regra do Marcos é identificar pelo responsável. Um campo de CPF aqui —
    // mesmo opcional — seria pedir documento de menor numa tela de
    // autoatendimento, e o servidor recusa o envio se o campo chegar.
    expect(CAMPOS_DA_CRIANCA).toEqual(["nome", "nascimento", "sexo"]);
    expect((CAMPOS_DA_CRIANCA as readonly string[])).not.toContain("cpf");
  });

  it("⚠️ MUTATION GUARD · nascimento é validado de verdade (31/02 não passa)", () => {
    // `new Date(2025, 1, 31)` NÃO estoura no JS — vira 03/03. Só o round-trip
    // pega, e sem isso a data inexistente iria pro banco.
    expect(nascimentoParaISO("31/02/2025")).toBeNull();
    expect(nascimentoParaISO("29/02/2024")).toBe("2024-02-29"); // bissexto existe
    expect(nascimentoParaISO("29/02/2025")).toBeNull();
    expect(nascimentoParaISO("10/13/2025")).toBeNull();
    expect(nascimentoParaISO("10/03/2025")).toBe("2025-03-10");
  });

  it("⚠️ nascimento FUTURO não passa (criança não nasceu ainda)", () => {
    expect(nascimentoParaISO("01/01/2099")).toBeNull();
  });

  it("filho próprio: só os dados da criança bastam", () => {
    expect(podeEnviarPedido("propria", CRI, { nome: "", telefone: "", email: "" })).toBe(true);
    expect(faltaNoPedido("propria", CRI, { nome: "", telefone: "", email: "" })).toEqual([]);
  });

  it("⚠️ filho de OUTRA pessoa exige nome e telefone do responsável", () => {
    // "Se for outra pessoa, ela tem que preencher os dados completos dos
    // responsáveis e criança" — palavras dele.
    const semResp = faltaNoPedido("outra", CRI, { nome: "", telefone: "", email: "" });
    expect(semResp).toContain("Nome do responsável");
    expect(semResp).toContain("Telefone do responsável");
    expect(podeEnviarPedido("outra", CRI, RESP)).toBe(true);
  });

  it("⚠️ MUTATION GUARD · sexo NÃO é obrigatório (o servidor aceita nulo)", () => {
    // Exigir aqui deixaria a tela mais rígida que a porta — a pessoa travaria
    // num campo que o servidor não pede.
    expect(podeEnviarPedido("propria", { ...CRI, sexo: null }, RESP)).toBe(true);
  });

  it("⚠️⚠️ MUTATION GUARD · o aviso DIZ em qual família a criança entra", () => {
    // Guarda do caso Benjamin/Mariane Gaia (lei do ERP · 22/07): quem está
    // agrupada na família da irmã pela Membresia colocaria o próprio filho na
    // família errada. O único jeito honesto de evitar é a pessoa LER o nome.
    expect(avisoDoVinculo("propria", "Família Silva")).toContain("Família Silva");
    // Sem household ainda, o aviso diz que uma vai ser criada — também é verdade.
    expect(avisoDoVinculo("propria", null)).toBeTruthy();
    // Filho de terceiro NÃO entra em família nenhuma: nada a avisar.
    expect(avisoDoVinculo("outra", "Família Silva")).toBeNull();
  });

  it("nome de 1 letra não passa (typo, não nome)", () => {
    expect(podeEnviarPedido("propria", { ...CRI, nome: "A" }, RESP)).toBe(false);
  });
});

// ── O OUTRO responsável · "tem que ter CPF" (Marcos · 11/08) ────────────────
describe("apresentação de criança · o outro responsável", () => {
  const CRI = { nome: "Ana Clara", nascimento: "10/03/2025", sexo: "F" as const };
  const RESP = { nome: "", telefone: "", email: "" };
  // CPFs com DV válido, gerados pro teste (não pertencem a ninguém do cadastro).
  const CPF_OK = "529.982.247-25";

  it("⚠️⚠️ MUTATION GUARD · CPF do outro responsável é OBRIGATÓRIO", () => {
    // É o oposto da criança, e é o ponto: adulto entra pelo Contrato de porta, e o
    // CPF é a chave mais forte do matcher — é ele que faz o cadastro ser
    // REENCONTRADO quando essa pessoa baixar o app, em vez de nascer um segundo.
    const semCpf = { nome: "João Silva", cpf: "", telefone: "", sexo: "M" as const };
    expect(faltaNoPedido("propria", CRI, RESP, semCpf)).toContain("CPF do outro responsável");
    expect(podeEnviarPedido("propria", CRI, RESP, semCpf)).toBe(false);
  });

  it("⚠️ MUTATION GUARD · bloco EM BRANCO não cobra nada (é opcional)", () => {
    // Exigir num bloco que ninguém quis usar travaria quem só quer apresentar
    // sozinha — que é o caso mais comum.
    expect(outroEmBranco(VAZIO_OUTRO)).toBe(true);
    expect(podeEnviarPedido("propria", CRI, RESP, VAZIO_OUTRO)).toBe(true);
    expect(faltaNoPedido("propria", CRI, RESP, VAZIO_OUTRO)).toEqual([]);
  });

  it("preenchido e válido passa", () => {
    const ok = { nome: "João Silva", cpf: CPF_OK, telefone: "", sexo: "M" as const };
    expect(outroEmBranco(ok)).toBe(false);
    expect(podeEnviarPedido("propria", CRI, RESP, ok)).toBe(true);
  });

  it("⚠️ nome sem sobrenome não passa (anti-abreviação do Contrato)", () => {
    const so1 = { nome: "João", cpf: CPF_OK, telefone: "", sexo: null };
    expect(faltaNoPedido("propria", CRI, RESP, so1)).toContain("Nome COMPLETO do outro responsável");
  });

  it("⚠️⚠️ MUTATION GUARD · DV do CPF é conferido, e repetido não passa", () => {
    // `111.111.111-11` PASSA no algoritmo do DV e não é CPF de ninguém. Sem a
    // guarda de sequência, ele entraria como identidade — e CPF é a chave mais
    // forte do matcher, então o erro contamina todas as portas.
    expect(cpfPareceValido("111.111.111-11")).toBe(false);
    expect(cpfPareceValido("00000000000")).toBe(false);
    expect(cpfPareceValido("529.982.247-24")).toBe(false); // DV trocado
    expect(cpfPareceValido(CPF_OK)).toBe(true);
    expect(cpfPareceValido("52998224725")).toBe(true); // só dígitos também
    expect(cpfPareceValido("5299822472")).toBe(false); // 10 dígitos
  });

  it("⚠️ o outro responsável NÃO existe no caminho de terceiro", () => {
    // "Se a pessoa que estiver pedindo não for a mãe ou pai, melhor não gerar
    // família, mais seguro" — ela não monta a família de terceiros.
    const ruim = { nome: "João", cpf: "", telefone: "", sexo: null };
    const respOk = { nome: "Joana Souza", telefone: "21999991111", email: "" };
    expect(faltaNoPedido("outra", CRI, respOk, ruim)).toEqual([]);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// DIÁLOGO DA CASA · e os alertas que FICAM nativos (11/08/2026)
//
// O Marcos reclamou DUAS vezes do "modal quadrado". Medido: 90 `Alert.alert` em
// 27 arquivos, 90 de 90 nativos, e nenhum componente de diálogo no repo.
// `components/ui/Dialogo.tsx` é a resposta — mas 3 casos NÃO migram, e este
// bloco existe pra impedir que a próxima sessão bem-intencionada os "limpe".
// ════════════════════════════════════════════════════════════════════════════
describe("diálogos nativos que ficam", () => {
  const raiz = process.cwd();
  const ler = (rel: string): string => {
    try { return readFileSync(join(raiz, rel), "utf8"); } catch { return ""; }
  };
  // ⚠️⚠️ Descontar COMENTÁRIO antes de procurar o código. Foi o que me pegou
  // QUATRO vezes em 11/08 — o próprio arquivo do diálogo cita `Alert.alert` na
  // explicação, e a contagem crua o lê como uso.
  // ⚠️ A régua é ÚNICA (`scripts/semComentarios.mjs`), a mesma que o portão de
  // i18n usa. Havia duas implementações divergentes, ambas por regex e nenhuma
  // testada — e a do regex **apagava o resto de qualquer linha com `//` dentro
  // de uma string** (caso vivo: `completar-cadastro.tsx:218`), escondendo dívida
  // em silêncio. Duas réguas pro mesmo conceito é como uma delas passa a mentir.

  it("⚠️⚠️ MUTATION GUARD · o SOS e os 2 pós-navegação seguem com Alert nativo", () => {
    for (const { arquivo, porque } of ALERTAS_QUE_FICAM_NATIVOS) {
      const src = semComentarios(ler(arquivo));
      if (!src) continue; // arquivo ausente não vira falso negativo
      expect(src, `${arquivo} perdeu o Alert nativo — leia o porquê: ${porque}`)
        .toContain("Alert.alert");
    }
  });

  it("cada alerta que fica tem um PORQUÊ escrito, não só uma lista", () => {
    expect(ALERTAS_QUE_FICAM_NATIVOS.length).toBeGreaterThan(0);
    for (const a of ALERTAS_QUE_FICAM_NATIVOS) {
      expect(a.porque.length, `${a.arquivo} sem justificativa`).toBeGreaterThan(80);
    }
  });

  it("⚠️ o diálogo é IRMÃO: quem usa o hook renderiza <dlg.Dialogo />", () => {
    // Chamar `confirmar()` sem montar o componente devolve uma promise que nunca
    // resolve — o fluxo trava em silêncio, sem erro nenhum na tela.
    const telas = ["app/(app)/grupo-detalhe.tsx", "app/(app)/apresentacao-crianca.tsx",
      "app/(app)/falar-com-a-igreja.tsx", "app/(app)/inscricao-batismo.tsx"];
    for (const tela of telas) {
      const src = ler(tela);
      if (!src) continue;
      if (src.includes("dlg.confirmar")) {
        expect(src, `${tela} usa dlg.confirmar e não renderiza <dlg.Dialogo />`)
          .toContain("<dlg.Dialogo />");
      }
    }
  });
});

// ════════════════════════════════════════════════════════════════════════════
// semComentarios · a régua que decide o que o portão de i18n ENXERGA
//
// ⚠️⚠️ Ela nasceu como regex e tinha um modo de falha PERVERSO: apagava o resto
// de qualquer linha em que uma string contivesse `//` — e com isso REMOVIA
// dívida real da contagem, em silêncio. Guarda que esconde o problema é pior que
// guarda nenhuma. Caso vivo no repo: `completar-cadastro.tsx:218`.
// ════════════════════════════════════════════════════════════════════════════
describe("semComentarios", () => {
  it("⚠️⚠️ MUTATION GUARD · string com `//` NÃO engole o resto da linha", () => {
    const src = String.raw`if (!r.startsWith("//")) g(); t("REAL");`;
    expect(semComentarios(src)).toContain("REAL");
  });

  it("URL dentro de string sobrevive", () => {
    expect(semComentarios(`const u = "https://x"; t("URL");`)).toContain("URL");
  });

  it("comentário de linha e de bloco somem", () => {
    expect(semComentarios(`t("A"); // t("SOME")`)).not.toContain("SOME");
    expect(semComentarios(`/* t("SOME") */ t("B");`)).not.toContain("SOME");
    expect(semComentarios(`/* t("SOME") */ t("B");`)).toContain(`t("B")`);
  });

  it("aspas escapada não desalinha o resto do arquivo", () => {
    const src = String.raw`const s = "tem \" aspas"; t("DEPOIS");`;
    expect(semComentarios(src)).toContain("DEPOIS");
  });

  it("crase (template literal) pode conter `//`", () => {
    expect(semComentarios("const a = `cra // se`; t(\"CRASE\");")).toContain("CRASE");
  });

  // ⚠️ Comprimento e linhas preservados: é o que faz linha/coluna de qualquer
  // relatório continuarem batendo com o arquivo real.
  it("preserva comprimento e quebras de linha", () => {
    const src = "a // b\nc";
    expect(semComentarios(src)).toHaveLength(src.length);
    expect(semComentarios("/* a\nb */\nc").split("\n")).toHaveLength(3);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// CONTRATO COM O ERP · o tipo do aviso de grupo (11/08/2026)
//
// ⚠️⚠️ O ERP emite `pedido_grupo` na tabela `notificacoes` (sino do web/staff) e
// o app roteia `grupo_pedido` em `app_notificacoes`. São INVERTIDOS, e foi por
// confiar nisso sem conferir que o aviso de grupo nunca chegou ao líder: 459
// pedidos desde 01/07 e ZERO linhas de tipo grupo (medido em 11/08).
//
// ⚠️ Esta guarda mora AQUI, e não no ERP, por um motivo prático: lá ela lia
// arquivo deste repo por caminho absoluto e no CI (ubuntu) devolvia vazio, então
// passava sem asserção nenhuma — guarda que não guarda. Aqui roda de verdade.
// ════════════════════════════════════════════════════════════════════════════
describe("aviso de grupo · o app tem que rotear o tipo que o ERP manda", () => {
  const TIPO = "grupo_pedido";
  const ler = (rel: string) => {
    try { return readFileSync(join(process.cwd(), rel), "utf8"); } catch { return ""; }
  };

  it("⚠️⚠️ MUTATION GUARD · os DOIS mapas entendem o tipo (eles divergem)", () => {
    // notifTap = toque na PUSH · notificacoes.tsx = toque na LISTA. São mapas
    // diferentes e já divergiram antes; um aviso que chega e não abre tela é o
    // mesmo que não avisar.
    expect(semComentarios(ler("lib/notifTap.ts")), "notifTap não roteia o tipo").toContain(`"${TIPO}"`);
    expect(semComentarios(ler("app/(app)/notificacoes.tsx")), "a lista não trata o tipo").toContain(`"${TIPO}"`);
  });

  it("o aviso aparece com ícone e cai no chip certo — senão vira 'Outros'", () => {
    const src = semComentarios(ler("app/(app)/notificacoes.tsx"));
    // ⚠️ Sem regex de propósito: `\s` dentro de template literal vira `s` e o
    // teste passa a procurar outra coisa (foi o que aconteceu na 1ª versão).
    expect(src, "sem ícone, o aviso aparece sem símbolo na lista").toContain(`${TIPO}: "`);
    expect(src, "sem categoria, o aviso não cai no chip Grupos").toContain('"Grupos"');
  });
});

// ════════════════════════════════════════════════════════════════════════════
// RESUMO DAS ESCALAS · o cabeçalho da seção RECOLHIDA (13/08/2026)
//
// ⚠️⚠️ A aba Servir passou a abrir com "Minhas escalas" e "Histórico de
// check-in" FECHADAS (pedido do Matheus). Recolher só é honesto se o cabeçalho
// disser o que ficou lá dentro — a escala que espera resposta é justamente a
// que não pode sumir atrás do triângulo.
// ════════════════════════════════════════════════════════════════════════════
describe("resumo das escalas · o que o cabeçalho recolhido anuncia", () => {
  const AGORA = new Date("2026-08-14T12:00:00-03:00");
  const futura = "2026-08-16T11:30:00";
  const passada = "2026-08-01T11:30:00";

  it("⚠️ pendente é só o que a pessoa AINDA pode responder", () => {
    expect(escalaPendeResposta({ confirmation_status: null, data: futura }, AGORA)).toBe(true);
    expect(escalaPendeResposta({ confirmation_status: "pending", data: futura }, AGORA)).toBe(true);
    // Já respondeu — ninguém está esperando por ela (nem no "recusada", que a
    // tela deixa reconfirmar).
    expect(escalaPendeResposta({ confirmation_status: "confirmed", data: futura }, AGORA)).toBe(false);
    expect(escalaPendeResposta({ confirmation_status: "declined", data: futura }, AGORA)).toBe(false);
  });

  it("⚠️ escala que já passou NÃO pede ação — a tela nem oferece confirmar", () => {
    expect(escalaPendeResposta({ confirmation_status: null, data: passada }, AGORA)).toBe(false);
  });

  it("⚠️ MUTATION GUARD · sem data (ou data ilegível) conta como pendente", () => {
    // Na dúvida a pessoa vê o aviso e abre. Abrir à toa é barato; perder a
    // escala, não.
    expect(escalaPendeResposta({ confirmation_status: null, data: null }, AGORA)).toBe(true);
    expect(escalaPendeResposta({ confirmation_status: null, data: "amanhã" }, AGORA)).toBe(true);
  });

  it("o resumo conta o total e quantas esperam resposta", () => {
    const r = resumoEscalas(
      [
        { confirmation_status: "confirmed", data: futura },
        { confirmation_status: null, data: futura },
        { confirmation_status: null, data: passada },
      ],
      AGORA
    );
    expect(r).toEqual({ total: 3, pendentes: 1 });
  });

  it("lista vazia não inventa número", () => {
    expect(resumoEscalas([], AGORA)).toEqual({ total: 0, pendentes: 0 });
  });
});

// ════════════════════════════════════════════════════════════════════════════
// CARTEIRA DIGITAL · cada plataforma na SUA (14/08/2026)
//
// ⚠️⚠️ O botão do cartão de membro era renderizado sem checar plataforma: o
// ANDROID via "Add to Apple Wallet" e o toque baixava um `.pkpass` — formato da
// Apple, que o Google Wallet nem abre. O destino do Android é o link assinado
// que o backend já emitia (`POST /public/membresia/wallet/google`) e que
// ninguém chamava.
// ════════════════════════════════════════════════════════════════════════════
describe("carteira digital · plataforma e falha", () => {
  it("⚠️ MUTATION GUARD · Android vai pra Carteira do Google, nunca pra Apple", () => {
    expect(carteiraDe("android")).toBe("google");
    expect(carteiraDe("ios")).toBe("apple");
  });

  it("plataforma sem carteira conhecida não promete botão", () => {
    expect(carteiraDe("web")).toBeNull();
    expect(carteiraDe("windows")).toBeNull();
  });

  it("⚠️ 503 é da IGREJA, não do cadastro da pessoa", () => {
    // Mandar alguém conferir o próprio CPF por causa de credencial que falta no
    // servidor é fazê-la procurar erro onde não há.
    expect(motivoFalhaCarteira(503)).toBe("nao_configurado");
    expect(motivoFalhaCarteira(404)).toBe("sem_cadastro");
    expect(motivoFalhaCarteira(400)).toBe("dado_invalido");
    expect(motivoFalhaCarteira(500)).toBe("outro");
  });
});

// ============================================================================
// dataLonga · DATA não é INSTANTE (18/08/2026)
//
// Relato do Marcos: "nos próximos encontros está escrito undefined, NaN de
// undefined, em todas as datas". A agenda estava CERTA — 20 ocorrências
// corretas até o fim da temporada. Quem quebrava era o formatador: ele monta
// `new Date(iso + "T12:00:00Z")`, e recebendo um INSTANTE
// ('2026-08-25T23:00:00.000Z') isso vira '…ZT12:00:00Z' = Invalid Date, com
// `DIAS_NOME[NaN]` = undefined e `getUTCDate()` = NaN.
//
// ⚠️ O typecheck NÃO pega: `data` e `inicio` são os dois `string`.
// ⚠️ E o formatador NÃO fatia o instante em 10 caracteres pra "se virar": às
// 22h BRT o dia UTC já virou e o corte devolveria o dia SEGUINTE. Converter
// instante → dia é decisão de quem tem o fuso.
// ============================================================================
describe("dataLonga · recebe DIA, nunca instante", () => {
  it("formata um 'YYYY-MM-DD'", async () => {
    const { dataLonga } = await import("../lib/proximoEncontro");
    expect(dataLonga("2026-08-25")).toBe("Terça, 25 de agosto");
  });

  it("⚠️ MUTATION GUARD · instante devolve vazio, NUNCA 'undefined, NaN de undefined'", async () => {
    const { dataLonga } = await import("../lib/proximoEncontro");
    const saida = dataLonga("2026-08-25T23:00:00.000Z");
    expect(saida).toBe("");
    expect(saida).not.toContain("undefined");
    expect(saida).not.toContain("NaN");
  });

  it("lixo e vazio também não viram texto quebrado", async () => {
    const { dataLonga } = await import("../lib/proximoEncontro");
    for (const v of ["", "25/08/2026", "2026-8-5", "amanhã"]) {
      expect(dataLonga(v as string)).toBe("");
    }
  });

  it("⚠️ data inexistente (30 de fevereiro) não vira data válida silenciosa", async () => {
    const { dataLonga } = await import("../lib/proximoEncontro");
    // O JS rola 30/02 para 02/03 — aqui isso apareceria como "Segunda, 2 de
    // março" num campo que a pessoa leria como 30 de fevereiro. Formato é
    // válido, então passa: fica REGISTRADO como limite conhecido, não como
    // promessa de validação de calendário.
    expect(dataLonga("2026-02-30")).toBe("Segunda, 2 de março");
  });
});

// ══════════════════════════════════════════════════════════════════════════
// ATALHO DA HOME · a quebra de linha do rótulo (27/08/2026)
//
// O Matheus pediu "crianças" embaixo e a 1ª tentativa (espaço inquebrável) não
// mudou nada — NBSP não FORÇA quebra, só impede. Estes casos travam a régua que
// substituiu o truque.
// ══════════════════════════════════════════════════════════════════════════
describe("rótulo do atalho · quebra depois da primeira palavra", () => {
  it("o caso que originou o pedido", () => {
    expect(quebrarAposPrimeiraPalavra("Apresentação de crianças"))
      .toBe("Apresentação\nde crianças");
  });

  it("⚠️ NBSP herdado do dicionário conta como separador", () => {
    // A chave antiga tinha ` ` depois de "Apresentação". Sem normalizar, o
    // rótulo seria UMA palavra gigante e a função devolveria o texto intacto —
    // exatamente o bug que ela conserta, de volta pela porta dos fundos.
    expect(quebrarAposPrimeiraPalavra("Apresentação\u00a0de crianças"))
      .toBe("Apresentação\nde crianças");
  });

  it("funciona em qualquer idioma, porque a régua é posicional", () => {
    expect(quebrarAposPrimeiraPalavra("Children's dedication")).toBe("Children's\ndedication");
    expect(quebrarAposPrimeiraPalavra("Presentación de niños")).toBe("Presentación\nde niños");
  });

  it("uma palavra só NÃO é quebrada — inventar quebra dentro da palavra é pior", () => {
    expect(quebrarAposPrimeiraPalavra("Voluntariado")).toBe("Voluntariado");
    expect(quebrarAposPrimeiraPalavra("NEXT")).toBe("NEXT");
  });

  it("entrada vazia ou espaço solto não vira quebra", () => {
    expect(quebrarAposPrimeiraPalavra("")).toBe("");
    expect(quebrarAposPrimeiraPalavra("Grupos ")).toBe("Grupos ");
    // @ts-expect-error entrada inesperada não pode estourar num rótulo de tela
    expect(quebrarAposPrimeiraPalavra(undefined)).toBe("");
  });
});

// ⚠️⚠️ Marcos · 27/08/2026: uma líder que serve há meses via "Comece a servir"
// na própria jornada. A causa: `serveVol` perguntava se ela preencheu o
// FORMULÁRIO público de voluntariado — e formulário não é serviço.
// Medido: das 598 pessoas com vínculo ativo, 314 (52%) não têm inscrição.
describe("jornada · quem serve é lido pela régua do sistema", () => {
  const base = { inscricao: null, voluntario_ativo: false, serve: null } as any;

  it("`serve: true` do servidor manda, mesmo sem inscrição nem perfil", () => {
    expect(decidirServe({ ...base, serve: true })).toBe(true);
  });

  // ⚠️ `false` é RESPOSTA, não ausência: quem parou de servir não pode ter o
  // check ressuscitado por uma inscrição antiga que ficou na base.
  it("`serve: false` NÃO cai no fallback da inscrição", () => {
    expect(decidirServe({ ...base, serve: false, inscricao: { id: "x" } })).toBe(false);
  });

  // Deploy em 2 etapas: o bundle novo pode falar com o servidor antigo.
  it("sem `serve`, cai no perfil e depois na inscrição (comportamento antigo)", () => {
    expect(decidirServe({ ...base, voluntario_ativo: true })).toBe(true);
    expect(decidirServe({ ...base, inscricao: { id: "x" } })).toBe(true);
    expect(decidirServe(base)).toBe(false);
  });
});
