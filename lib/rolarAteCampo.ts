// ============================================================================
// ROLAR ATÉ O CAMPO · a régua pura por trás do `FormularioRolavel`
//
// Relato do Marcos (23/09/2026), no completar cadastro: *"quando a pessoa está
// dizendo quem é, quando o teclado sobe também fica difícil de ver"*.
//
// O `TecladoSeguro` garante que o teclado não COBRE o campo (folga embaixo),
// mas não garante que o campo esteja VISÍVEL: com o herói (ícone + título +
// explicação) ocupando o topo, o campo focado fica espremido na faixa que
// sobrou entre o herói e o teclado — e em aparelho pequeno essa faixa é menor
// que o campo. Rolar o formulário até o campo, com o rótulo visível acima,
// resolve nas duas plataformas: no iOS a folga do TecladoSeguro encolhe a área
// visível; no Android a janela encolhe (`resize`). Nos dois casos, o alvo é
// "campo no topo da área que sobrou, com respiro pro rótulo".
// ============================================================================
import { spacing } from "@/constants/theme";

/** Respiro acima do campo quando ele vai pro topo — dá pra ler o rótulo. */
export const FOLGA_ACIMA_DO_CAMPO = spacing.lg;

/**
 * Tempo entre o foco e a rolagem. O teclado leva ~100 ms pra começar a subir;
 * rolar antes disso, no Android com `resize`, rola pra uma altura que muda no
 * quadro seguinte. Medido de forma conservadora.
 */
export const ATRASO_TECLADO_MS = 120;

/**
 * Posição (em coordenadas do CONTEÚDO da ScrollView) pra onde rolar quando o
 * campo em `yCampo` ganha foco. Nunca negativa; arredondada pra evitar
 * `scrollTo` fracionário no Android.
 */
export function alvoDaRolagem(yCampo: number, folga: number = FOLGA_ACIMA_DO_CAMPO): number {
  if (!Number.isFinite(yCampo)) return 0;
  return Math.max(0, Math.round(yCampo - folga));
}
