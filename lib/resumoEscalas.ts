// Resumo das minhas escalas — o que o cabeçalho da seção RECOLHIDA mostra.
//
// ⚠️⚠️ POR QUE ISTO EXISTE: a partir de 13/08/2026 as seções "Minhas escalas" e
// "Histórico de check-in" abrem FECHADAS (pedido do Matheus — a aba Servir
// começava com uma parede de cartões). Esconder conteúdo só é honesto se o
// cabeçalho continuar dizendo o que está lá dentro: uma escala que espera
// resposta não pode ficar invisível atrás de um triângulo.
//
// ⚠️ Régua PURA, em lib/, porque arquivo que importa react-native não roda no
// portão (a lei da casa). A tela só desenha o que esta função contar.
export type EscalaResumida = { confirmation_status?: string | null; data?: string | null };

export type ResumoEscalas = { total: number; pendentes: number };

/**
 * A escala ESPERA uma resposta desta pessoa?
 *
 * ⚠️ `declined` NÃO pende: a pessoa já respondeu (ela ainda pode reconfirmar
 * tocando no cartão, mas ninguém está esperando por ela).
 * ⚠️ Escala que já passou não pende — não existe confirmar depois do culto, e
 * contá-la faria o cabeçalho pedir ação que a tela não oferece.
 * ⚠️ Data ausente ou ilegível conta como PENDENTE: na dúvida a pessoa vê o
 * aviso e abre. O erro barato é abrir à toa; o caro é perder a escala.
 */
export function escalaPendeResposta(e: EscalaResumida, agora: Date): boolean {
  const status = (e.confirmation_status ?? "").toLowerCase();
  if (status === "confirmed" || status === "declined") return false;
  if (!e.data) return true;
  const quando = new Date(e.data).getTime();
  if (Number.isNaN(quando)) return true;
  return quando >= agora.getTime();
}

export function resumoEscalas(escalas: EscalaResumida[], agora: Date): ResumoEscalas {
  return {
    total: escalas.length,
    pendentes: escalas.filter((e) => escalaPendeResposta(e, agora)).length,
  };
}
