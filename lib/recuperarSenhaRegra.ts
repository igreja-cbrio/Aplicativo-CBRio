// "ESQUECI A SENHA" DE QUEM NUNCA TEVE CONTA (27/11/2026 · Fase 3 da entrada).
//
// Medido no lançamento: 18 CPFs pediram o link (34 tentativas) e NENHUM tinha
// conta no app. A tela respondia "se houver uma conta, você receberá o e-mail" e
// a pessoa ficava esperando um e-mail que não existia; 9 nunca entraram.
// Decisão do Marcos (26/11): CPF sem conta vai para a tela de criar conta, onde
// a pessoa define a primeira senha. O servidor já devolve `semConta: true`
// (igual para CPF sem cadastro e para cadastro sem conta).
//
// Régua PURA (sem React, sem rede). O CPF viaja só em MEMÓRIA até a tela de
// cadastro: nada de parâmetro de rota (a rota vai para a telemetria) nem de
// armazenamento no aparelho.

export type DesfechoRecuperar = "sem_conta" | "enviado" | "generico";

/** O que a resposta do servidor quer dizer para a tela. */
export function desfechoRecuperar(resposta: unknown): DesfechoRecuperar {
  const r = (resposta && typeof resposta === "object" ? resposta : {}) as { semConta?: unknown; emailMascarado?: unknown };
  if (r.semConta === true) return "sem_conta";
  if (typeof r.emailMascarado === "string" && r.emailMascarado) return "enviado";
  return "generico";
}

/**
 * Chave de tradução do erro. Nunca o texto do servidor nem o erro de rede cru:
 * a tela mostrava `e.message` ("Erro 500", "Network request failed").
 */
export function mensagemErroRecuperar(e: unknown): string {
  const status = e && typeof e === "object" && typeof (e as { status?: unknown }).status === "number"
    ? (e as { status: number }).status
    : 0;
  if (status === 429) return "Muitas tentativas. Espere alguns minutos e tente de novo.";
  if (status === 400) return "Informe um CPF válido.";
  if (!status) return "Sem conexão com a internet agora. Confira a rede e tente de novo.";
  return "Não foi possível enviar o e-mail.";
}

/** Só o enum vai para a telemetria (nunca CPF, e-mail ou mensagem). */
export function motivoErroRecuperar(e: unknown): string {
  const status = e && typeof e === "object" && typeof (e as { status?: unknown }).status === "number"
    ? (e as { status: number }).status
    : 0;
  if (status === 429) return "limite";
  if (!status) return "rede";
  return "erro";
}

// ── O CPF que viaja até a tela de criar conta ───────────────────────────────
const VALIDADE_MS = 5 * 60 * 1000;
let guardado: { cpf: string; em: number } | null = null;

export function guardarCpfSemConta(cpf: string, agora: number = Date.now()) {
  const digitos = String(cpf || "").replace(/\D/g, "");
  guardado = digitos.length === 11 ? { cpf: digitos, em: agora } : null;
}

/** Devolve o CPF UMA vez (e apaga). Vencido, devolve null. */
export function consumirCpfSemConta(agora: number = Date.now()): string | null {
  const atual = guardado;
  guardado = null;
  if (!atual || agora - atual.em > VALIDADE_MS) return null;
  return atual.cpf;
}
