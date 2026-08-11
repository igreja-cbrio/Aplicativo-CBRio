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
  return falta;
}

export function podeEnviarPedido(
  quem: QuemApresenta,
  crianca: CriancaForm,
  responsavel: ResponsavelForm,
): boolean {
  return faltaNoPedido(quem, crianca, responsavel).length === 0;
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
