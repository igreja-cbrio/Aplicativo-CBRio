// ============================================================================
// APRESENTAÇÃO DE CRIANÇA · a régua da tela (11/08/2026)
//
// Pedido do Marcos: *"quando a pessoa marcar que quer apresentar bebê, já que já
// temos os dados dela dentro do app, tem que perguntar se o filho é dela; se sim,
// indicar o vínculo, completar os dados se a criança não existir como família já.
// Se for outra pessoa, ela tem que preencher os dados completos dos responsáveis
// e criança, tudo dentro do app e não em link externo."*
//
// E a regra de identidade: *"deve gerar pessoa no sistema que aparece em minha
// família, com as regras de criança, SEM CPF, identificamos pelo pai."*
//
// ⚠️ Esta régua é ESPELHO da do servidor (`backend/utils/criancaApresentacao.js`).
// Ela existe pra a tela dizer o que falta ANTES de gastar uma requisição — quem
// decide é o servidor. Se as duas discordarem, o servidor manda.
// ============================================================================

export type QuemApresenta = "propria" | "outra";

export type CriancaForm = {
  nome: string;
  /** DD/MM/AAAA — o que a pessoa digita. */
  nascimento: string;
  sexo: "M" | "F" | null;
};

export type ResponsavelForm = {
  nome: string;
  telefone: string;
  email: string;
};

/**
 * O OUTRO responsável (o outro pai/mãe), pedido pelo Marcos em 11/08: *"preciso
 * que esse formulário tenha a opção de adicionar responsável, e aí já vamos criar
 * essa família no sistema e se esse pai baixar o app já aparece lá para ele a sua
 * família alinhada, **tem que ter CPF**."*
 */
export type OutroResponsavelForm = {
  nome: string;
  cpf: string;
  telefone: string;
  sexo: "M" | "F" | null;
};

export const VAZIO_OUTRO: OutroResponsavelForm = { nome: "", cpf: "", telefone: "", sexo: null };

/** O bloco está em branco? Aí é porque a pessoa não quis adicionar ninguém. */
export function outroEmBranco(o: OutroResponsavelForm): boolean {
  return !String(o?.nome ?? "").trim() && !String(o?.cpf ?? "").replace(/\D/g, "");
}

/**
 * ⚠️ CPF NÃO EXISTE NESTE FORMULÁRIO, e o teste garante isso.
 *
 * A régua do Marcos é "sem CPF, identificamos pelo pai". Um campo de CPF aqui —
 * mesmo opcional — seria pedido de documento de menor numa tela de autoatendimento,
 * e o servidor recusa o envio se o campo chegar.
 */
export const CAMPOS_DA_CRIANCA = ["nome", "nascimento", "sexo"] as const;

/** Converte DD/MM/AAAA em AAAA-MM-DD, ou null se não é data real. */
export function nascimentoParaISO(v: string): string | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(v ?? "").trim());
  if (!m) return null;
  const [, dd, mm, aaaa] = m;
  const dia = Number(dd);
  const mes = Number(mm);
  const ano = Number(aaaa);
  if (mes < 1 || mes > 12 || dia < 1) return null;
  // ⚠️ Meio-dia LOCAL, nunca `new Date("AAAA-MM-DD")`: essa forma é UTC e em fuso
  // negativo devolve o dia anterior (a armadilha da faixa etária).
  const d = new Date(ano, mes - 1, dia, 12, 0, 0);
  if (Number.isNaN(d.getTime())) return null;
  // 31/02 não estoura no JS — vira 02/03. Só o round-trip pega.
  if (d.getFullYear() !== ano || d.getMonth() !== mes - 1 || d.getDate() !== dia) return null;
  if (d > new Date()) return null;
  return `${aaaa}-${mm}-${dd}`;
}

/**
 * O que ainda falta preencher. Lista VAZIA = pode enviar.
 *
 * ⚠️ Devolve os RÓTULOS que a pessoa vê, não os nomes dos campos: a mensagem
 * "falta Data de nascimento" é acionável; "falta data_nascimento" não é.
 */
export function faltaNoPedido(
  quem: QuemApresenta,
  crianca: CriancaForm,
  responsavel: ResponsavelForm,
  outro?: OutroResponsavelForm,
): string[] {
  const falta: string[] = [];
  if (String(crianca.nome ?? "").trim().length < 2) falta.push("Nome da criança");
  if (!nascimentoParaISO(crianca.nascimento)) falta.push("Data de nascimento da criança");

  // ⚠️ Sexo NÃO entra: a régua do servidor o aceita nulo. Exigir aqui criaria uma
  // barreira que o servidor não tem — e a tela ficaria mais rígida que a porta.

  if (quem === "outra") {
    if (String(responsavel.nome ?? "").trim().length < 2) falta.push("Nome do responsável");
    const tel = String(responsavel.telefone ?? "").replace(/\D/g, "");
    if (tel.length < 10 || tel.length > 11) falta.push("Telefone do responsável");
  }

  /**
   * ⚠️⚠️ CPF É OBRIGATÓRIO AQUI — o oposto da criança, e é o ponto.
   *
   * "Tem que ter CPF" (Marcos). É ADULTO: o CPF é a chave mais forte do matcher do
   * sistema, e é ele que faz o cadastro ser REENCONTRADO quando essa pessoa baixar
   * o app, em vez de nascer um segundo. Sem CPF, o responsável entraria como um
   * homônimo solto e a "família alinhada" nunca apareceria pra ele.
   *
   * ⚠️ Só cobra quando a pessoa começou a preencher o bloco: ele é OPCIONAL, e
   * exigir num bloco em branco travaria quem só quer apresentar sozinha.
   */
  if (quem === "propria" && outro && !outroEmBranco(outro)) {
    const nome = String(outro.nome ?? "").trim();
    if (nome.length < 2) falta.push("Nome do outro responsável");
    else if (!nome.includes(" ")) falta.push("Nome COMPLETO do outro responsável");
    if (!cpfPareceValido(outro.cpf)) falta.push("CPF do outro responsável");
  }

  return falta;
}

/**
 * DV do CPF, espelho de `backend/utils/cpf.cpfValido`.
 *
 * ⚠️ Existe pra a tela dizer "esse CPF não confere" ANTES de gastar requisição —
 * quem decide é o servidor. E recusa sequência repetida: `111.111.111-11` passa no
 * algoritmo do DV e não é CPF de ninguém.
 */
export function cpfPareceValido(v: string): boolean {
  const d = String(v ?? "").replace(/\D/g, "");
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  for (const n of [9, 10]) {
    let soma = 0;
    for (let i = 0; i < n; i++) soma += Number(d[i]) * (n + 1 - i);
    const dv = ((soma * 10) % 11) % 10;
    if (dv !== Number(d[n])) return false;
  }
  return true;
}

export function podeEnviarPedido(
  quem: QuemApresenta,
  crianca: CriancaForm,
  responsavel: ResponsavelForm,
  outro?: OutroResponsavelForm,
): boolean {
  return faltaNoPedido(quem, crianca, responsavel, outro).length === 0;
}

/**
 * O que a tela avisa que vai acontecer, antes de a pessoa confirmar.
 *
 * ⚠️⚠️ ISTO NÃO É DECORAÇÃO — é a guarda do caso Benjamin/Mariane Gaia (lei do
 * ERP, 22/07): quem está agrupada na família da irmã pela Membresia colocaria o
 * próprio filho na família errada. A pessoa tem que LER em qual família a criança
 * entra. Sem nome de família (ainda não tem household), o texto diz que uma vai
 * ser criada — que também é verdade e também precisa ser dita.
 */
export function avisoDoVinculo(quem: QuemApresenta, familiaNome: string | null): string | null {
  if (quem !== "propria") return null;
  return familiaNome
    ? `A criança vai entrar na sua família (${familiaNome}) e aparecer em "Minha família".`
    : `Vamos criar a sua família no sistema e a criança vai aparecer em "Minha família".`;
}

// ============================================================================
// SAÚDE / INCLUSÃO DA CRIANÇA (11/08/2026)
//
// Apontamento do Marcos: *"a criação de uma criança no Kids gera mais campos do
// que temos na apresentação de bebê, exemplo dos campos de alergia, deficiência
// física... Eu só não quero ter crianças ou pessoas com dados faltando porque em
// um lugar pede uma coisa e no outro pede outra."*
//
// Medido em 11/08: das crianças criadas desde 28/07, **34 pela porta do Kids têm
// saúde respondida (100%)** e **as 2 que entraram pela apresentação, nenhuma**.
//
// ⚠️⚠️ E o dano é concreto: `tem_espectro` e `tem_limitacao_fisica` são a régua do
// PAGER no totem do Kids — obrigatório desde 03/08. Criança com autismo que entra
// por esta porta chega no domingo com o campo NULO e não cai na regra.
//
// ⚠️ Espelho de `backend/utils/saudeCrianca.js`. Mudou lá, muda aqui.
// ============================================================================

export type SaudeForm = {
  /** `null` = ainda não respondeu. NÃO é "não". */
  tem_alergia: boolean | null;
  alergia_qual: string;
  tem_espectro: boolean | null;
  espectro_qual: string;
  tem_limitacao_fisica: boolean | null;
  limitacao_fisica_qual: string;
};

export const VAZIO_SAUDE: SaudeForm = {
  tem_alergia: null, alergia_qual: "",
  tem_espectro: null, espectro_qual: "",
  tem_limitacao_fisica: null, limitacao_fisica_qual: "",
};

/** As 3 perguntas, na ordem em que a tela mostra. */
export const PERGUNTAS_SAUDE = [
  {
    campo: "tem_alergia", detalhe: "alergia_qual",
    titulo: "Tem alergia?",
    ajuda: "Alimento, medicamento, picada — o que a equipe precisa saber antes do lanche.",
    placeholder: "Alergia a quê?",
  },
  {
    campo: "tem_espectro", detalhe: "espectro_qual",
    titulo: "É autista (TEA)?",
    ajuda: "A gente prepara a sala e entrega o pager pra família.",
    placeholder: "O que ajuda a acolher bem? (opcional)",
  },
  {
    campo: "tem_limitacao_fisica", detalhe: "limitacao_fisica_qual",
    titulo: "Tem alguma limitação física?",
    ajuda: "Pra receber a criança do jeito certo — e a família também leva pager.",
    placeholder: "Qual? (opcional)",
  },
] as const satisfies ReadonlyArray<{
  campo: keyof SaudeForm; detalhe: keyof SaudeForm;
  titulo: string; ajuda: string; placeholder: string;
}>;

/**
 * O que vai no payload.
 *
 * ⚠️⚠️ Pergunta não respondida **não entra** — nem como `false`. `null` no banco é
 * "ninguém perguntou" (o estado de 98% da base); `false` é "a família disse que
 * não". Mandar `false` onde não se perguntou transformaria "não sei" em "não tem",
 * e a régua do pager passaria a EXCLUIR criança sobre a qual não se sabe nada.
 *
 * ⚠️ O texto do detalhe só vale com resposta SIM — detalhe preenchido junto de um
 * "não" é contradição que alguém lê no domingo sem saber de que lado ficar.
 */
export function saudeParaPayload(s: SaudeForm): Record<string, boolean | string> {
  const out: Record<string, boolean | string> = {};
  for (const p of PERGUNTAS_SAUDE) {
    const v = s[p.campo];
    if (v !== true && v !== false) continue;
    out[p.campo] = v;
    if (v === true) {
      const txt = String(s[p.detalhe] ?? "").trim();
      if (txt) out[p.detalhe] = txt.slice(0, 500);
    }
  }
  return out;
}

/**
 * A família vai receber pager por INCLUSÃO?
 *
 * ⚠️ Só pra AVISAR na hora em que ela responde sim — quem decide o pager é o totem,
 * no check-in. `null` (não perguntado) nunca é `true`: não inventamos inclusão.
 */
export function avisaPagerInclusao(s: SaudeForm): boolean {
  return s.tem_espectro === true || s.tem_limitacao_fisica === true;
}
