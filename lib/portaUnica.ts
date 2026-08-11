// ============================================================================
// FALAR COM A CBRIO · a porta única (11/08/2026 · apontamento 14)
//
// Decisão do Marcos, depois de eu levantar as portas existentes:
// *"vamos separar em duas portas então, uma que é esse contato SOS, que tem que
// ser destacado como é hoje, e a outra é o fale com a CBRio: ao clicar, você
// teria 3 opções — marcar conversa com pastor, pedir oração, e a terceira opção
// de enviar mensagem de dúvida, sugestão, pedido ou feedback."*
//
// ⚠️⚠️ O SOS FICA FORA DESTA RÉGUA, DE PROPÓSITO. Ele é a única dessas portas
// que pode salvar alguém em minuto zero — tem tela própria, destaque próprio e
// oferece CVV 188 / SAMU 192 ANTES de qualquer formulário. Transformá-lo em item
// de lista somaria dois toques entre a pessoa e o socorro. Ele continua exatamente
// onde está.
//
// ⚠️ AS 3 OPÇÕES MAPEIAM 1-PARA-1 EM TIPOS QUE JÁ EXISTEM (`aconselhamento`,
// `oracao`, `contato`). Nenhum tipo novo, nenhuma migration, e a fila do
// Cuidados no ERP continua entendendo tudo. Inventar categoria nova aqui criaria
// um terceiro vocabulário pra "o que você precisa" — `conversas_setores` e
// `cui_pedidos` já têm o deles, e três taxonomias é pior que três portas.
// ============================================================================

/** O tipo que vai pra `app_inscricoes.tipo` — os três já existiam. */
export type TipoPedido = "aconselhamento" | "oracao" | "contato";

export type OpcaoPorta = {
  tipo: TipoPedido;
  /** Rótulo do botão, em português (a chave do i18n). */
  titulo: string;
  /** Uma linha dizendo o que acontece depois de enviar. */
  ajuda: string;
  /** Ícone Ionicons. */
  icone: "chatbubbles" | "heart" | "mail";
  /**
   * Exige texto pra enviar?
   *
   * ⚠️ A conversa com pastor NÃO exige: hoje ela é um botão só, e quem procura
   * um pastor muitas vezes não sabe (ou não quer) escrever o motivo num campo.
   * Obrigar texto aqui seria criar barreira onde antes não havia.
   */
  exigeMensagem: boolean;
};

/**
 * As 3 opções, na ordem que o Marcos pediu.
 *
 * ⚠️ A ORDEM não é estética: "conversa com pastor" primeiro porque é o pedido
 * mais pesado dos três, e a lista é lida de cima pra baixo por quem já está
 * mal. "Dúvida/sugestão" fica por último — é o mais leve e o mais frequente,
 * mas quem chega aqui em sofrimento não deve tropeçar nele primeiro.
 */
export const OPCOES_PORTA: readonly OpcaoPorta[] = [
  {
    tipo: "aconselhamento",
    titulo: "Marcar conversa com um pastor",
    ajuda: "Um pastor ou líder entra em contato com você.",
    icone: "chatbubbles",
    exigeMensagem: false,
  },
  {
    tipo: "oracao",
    titulo: "Pedir oração",
    ajuda: "Sua equipe de cuidado ora por você.",
    icone: "heart",
    exigeMensagem: true,
  },
  {
    tipo: "contato",
    titulo: "Dúvida, sugestão, pedido ou feedback",
    ajuda: "A equipe lê e responde.",
    icone: "mail",
    exigeMensagem: true,
  },
] as const;

/** A opção pelo tipo, ou `null` se o tipo não é desta porta (ex.: `sos`). */
export function opcaoPorTipo(tipo: string | null | undefined): OpcaoPorta | null {
  return OPCOES_PORTA.find((o) => o.tipo === tipo) ?? null;
}

/**
 * Pode enviar?
 *
 * ⚠️ Só valida o que a régua sabe: opção existe e, quando ela exige texto, o
 * texto não está vazio. Espaço em branco não conta como mensagem — senão a fila
 * do Cuidados recebe pedido sem conteúdo e alguém liga pra pessoa sem saber o
 * assunto.
 */
export function podeEnviar(tipo: string | null | undefined, mensagem: string | null | undefined): boolean {
  const opcao = opcaoPorTipo(tipo);
  if (!opcao) return false;
  if (!opcao.exigeMensagem) return true;
  return String(mensagem ?? "").trim().length > 0;
}

/**
 * O SOS pertence a esta porta?
 *
 * ⚠️ Existe pra a resposta `false` ficar visível numa busca do repo. Se alguém
 * um dia acrescentar `sos` em `OPCOES_PORTA`, este teste falha — e é o que
 * impede o socorro de virar item de menu.
 */
export function ehDaPortaUnica(tipo: string | null | undefined): boolean {
  return opcaoPorTipo(tipo) !== null;
}
