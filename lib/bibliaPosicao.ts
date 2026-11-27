// ============================================================================
// ONDE A PESSOA PAROU NA BÍBLIA (27/11/2026 · memória por aba)
//
// Pedido do Marcos: "a pessoa está lendo Gálatas, sai, e quando volta abre a
// página central da Bíblia; e se ela voltasse na leitura dela?". Desde a
// mesma data a Bíblia não tem menu (só a seta), então sair dela é sempre
// fechar a tela, e a memória por aba (lib/abas.ts) não a mantém viva.
//
// Regra: quem volta à Bíblia em até JANELA_MS reabre no MESMO capítulo, versão
// e ponto da rolagem. Passou disso, ou o app foi fechado (a memória é do
// processo, não do disco), abre na lista de livros como decidido em 25/11, com
// o atalho "continuar" e Minhas anotações/Meu histórico à vista.
// ============================================================================

export type PosicaoBiblia = { livro: string; numero: number; versao: string; y: number; em: number };

/** Quanto tempo fora ainda conta como "dei uma saída rápida". */
export const JANELA_MS = 10 * 60 * 1000;

let ultima: PosicaoBiblia | null = null;

/** Chamado enquanto um capítulo está aberto (abertura e rolagem). */
export function guardarPosicaoBiblia(posicao: PosicaoBiblia) {
  ultima = posicao;
}

/** A posição para reabrir, ou `null` se passou da janela (ou nunca houve). */
export function posicaoBibliaRecente(agora: number): PosicaoBiblia | null {
  if (!ultima) return null;
  const decorrido = agora - ultima.em;
  return decorrido >= 0 && decorrido <= JANELA_MS ? ultima : null;
}

/** Para testes e para a saída da conta. */
export function esquecerPosicaoBiblia() {
  ultima = null;
}
