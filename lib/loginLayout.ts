/** O formulário tem prioridade; o vídeo usa só o espaço que sobra na tela.
 * Medidas vêm do layout real (incluem traduções, fonte e botões de cada SO).
 * Em teclado aberto/fontes muito grandes preservamos uma marca mínima e
 * deixamos o formulário rolar, em vez de esconder ações ou reduzir a fonte.
 */
export function alturaVideoLogin(viewport: number, formulario: number, safeTop: number) {
  const minimo = Math.max(0, safeTop) + 60;
  const preferida = Math.min(240, Math.max(minimo, viewport * 0.28));
  return Math.max(minimo, Math.min(preferida, viewport - Math.max(0, formulario)));
}
