// O PASSO DO CÓDIGO SOBREVIVE A SAIR DO APP (27/11/2026 · Fase 2 da entrada).
//
// Medido no lançamento (25-26/11): no Android, sair do app para ler o código
// mata o processo; ao voltar, a tela recomeçava no CPF e a pessoa não tinha
// onde digitar o código que acabou de receber. Desde 27/11 quem já tem cadastro
// na igreja SEMPRE confirma por código, então esse passo virou o caminho de
// quase todo mundo e não pode se perder.
//
// O que fica guardado, por conta: o CPF digitado, o id do pedido de código, por
// onde ele foi enviado (já mascarado pelo servidor) e até quando vale. O código
// em si nunca passa por aqui.
//
// Este arquivo é a régua PURA (entra no portão). A gravação no aparelho fica em
// lib/codigoAberto.ts, que importa o AsyncStorage e por isso não roda no CI.

export type CodigoAberto = {
  cpf: string;
  verificacaoId: string;
  canal: "email" | "whatsapp";
  destino: string | null;
  nome: string | null;
  expiraEm: number;
};

type RespostaPedido = {
  verificacao_id?: string;
  canal?: string;
  destino_mascarado?: string | null;
  email_mascarado?: string | null;
  telefone_mascarado?: string | null;
  nome_mascarado?: string | null;
  expira_em_min?: number;
};

// Sem prazo na resposta (servidor antigo), guarda por pouco tempo: código
// vencido na tela é pior que pedir de novo.
const MINUTOS_PADRAO = 10;
const soDigitos = (s: string) => String(s || "").replace(/\D/g, "");

export function montarCodigoAberto(r: RespostaPedido, cpf: string, agora: number = Date.now()): CodigoAberto | null {
  const cpfLimpo = soDigitos(cpf);
  if (!r?.verificacao_id || cpfLimpo.length !== 11) return null;
  const minutos = typeof r.expira_em_min === "number" && r.expira_em_min > 0 ? r.expira_em_min : MINUTOS_PADRAO;
  const canal = r.canal === "whatsapp" ? "whatsapp" : "email";
  return {
    cpf: cpfLimpo,
    verificacaoId: r.verificacao_id,
    canal,
    destino: r.destino_mascarado || (canal === "whatsapp" ? r.telefone_mascarado : r.email_mascarado) || null,
    nome: r.nome_mascarado || null,
    expiraEm: agora + minutos * 60 * 1000,
  };
}

export function codigoAbertoValido(bruto: unknown, agora: number = Date.now()): CodigoAberto | null {
  const o = (bruto && typeof bruto === "object" ? bruto : {}) as Partial<CodigoAberto>;
  if (typeof o.verificacaoId !== "string" || !o.verificacaoId) return null;
  if (typeof o.cpf !== "string" || soDigitos(o.cpf).length !== 11) return null;
  if (typeof o.expiraEm !== "number" || o.expiraEm <= agora) return null;
  return {
    cpf: soDigitos(o.cpf),
    verificacaoId: o.verificacaoId,
    canal: o.canal === "whatsapp" ? "whatsapp" : "email",
    destino: typeof o.destino === "string" && o.destino ? o.destino : null,
    nome: typeof o.nome === "string" && o.nome ? o.nome : null,
    expiraEm: o.expiraEm,
  };
}

