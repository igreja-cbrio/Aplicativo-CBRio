/**
 * "Leu até o fim" (25/11/2026 · Investir): o capítulo da Bíblia conta quando a
 * pessoa chega ao FIM do texto, não quando abre. `folgaFinal` é o espaço vazio que
 * a tela põe depois do último versículo (barras flutuantes); `tolerancia` absorve
 * o arredondamento da rolagem. Texto que cabe inteiro na tela conta de cara.
 */
export function chegouAoFim(p: { rolagem: number; alturaVisivel: number; alturaConteudo: number; folgaFinal?: number; tolerancia?: number }): boolean {
  const { rolagem, alturaVisivel, alturaConteudo } = p;
  if (!(alturaVisivel > 0) || !(alturaConteudo > 0)) return false;
  const fimDoTexto = alturaConteudo - Math.max(0, p.folgaFinal ?? 0);
  return rolagem + alturaVisivel >= fimDoTexto - Math.max(0, p.tolerancia ?? 40);
}
