// ============================================================================
// FOLGA DO TECLADO · a régua que substitui número ajustado à mão (07/08/2026)
//
// Marcos, ao ler que eu ia "medir tela a tela": *"você tá dizendo pra medir o
// celular das pessoas que usam? Faz de uma forma para ficar padrão."*
//
// Ele está certo, e a proposta anterior era ruim: o `keyboardVerticalOffset` do
// `KeyboardAvoidingView` exige um número POR TELA (a altura da faixa superior,
// do inset do notch…), calibrado num aparelho — e aparelho diferente, fonte
// maior ou tela dobrável já saem do calibre. Número decorado envelhece.
//
// A régua aqui não decora nada: compara a posição REAL do container na tela com
// a posição REAL do topo do teclado, as duas medidas em tempo de execução. Não
// existe constante de aparelho nenhuma.
//
// ⚠️ E é AUTO-CORRETIVA nos dois mundos do Android:
//   · janela que encolhe sozinha (adjustResize) → o container já termina ACIMA
//     do teclado ⇒ sobreposição 0 ⇒ nenhuma folga extra (não soma duas vezes);
//   · janela que NÃO encolhe (dentro de `<Modal>`, e no Android com
//     edge-to-edge, que é o padrão do SDK 54) → a sobreposição é exatamente a
//     parte coberta.
// ============================================================================

/**
 * Quanto o teclado cobre do container, em dp.
 *
 * @param fundoDoContainer borda de baixo do container, em coordenadas da JANELA
 *   (`measureInWindow` → `y + height`).
 * @param topoDoTeclado borda de cima do teclado (`endCoordinates.screenY`), ou
 *   `null` quando o teclado está fechado.
 * @param alturaMax teto de sanidade — normalmente a altura do próprio teclado.
 */
export function folgaDoTeclado(
  fundoDoContainer: number,
  topoDoTeclado: number | null | undefined,
  alturaMax?: number,
): number {
  if (topoDoTeclado == null) return 0;
  if (!Number.isFinite(fundoDoContainer) || !Number.isFinite(topoDoTeclado)) return 0;
  // ⚠️ `max(0, …)` não é detalhe: quando o container termina ACIMA do teclado a
  // conta dá NEGATIVO, e padding negativo no RN puxa o conteúdo pra fora da
  // tela — seria trocar "campo coberto" por "campo cortado".
  const bruta = Math.max(0, fundoDoContainer - topoDoTeclado);
  // ⚠️ Teto de sanidade: se uma medida vier absurda (tela em transição, layout
  // no meio de animação), é melhor empurrar o conteúdo até a altura do teclado
  // do que criar um vão gigante que esconde a tela inteira.
  if (alturaMax != null && Number.isFinite(alturaMax)) {
    return Math.min(bruta, Math.max(0, alturaMax));
  }
  return bruta;
}
