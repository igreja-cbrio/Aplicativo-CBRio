// ============================================================================
// FUNDO DA FOLHA · quanto a folha (bottom sheet) precisa deixar embaixo
//
// ⚠️⚠️ Relato do Marcos, DUAS vezes no mesmo botão:
//   · 25/08 (item 4): "subir um pouco pois esse botão fica onde estão os botões
//     do Android, dificultando" → as folhas ganharam um PISO de 24 dp.
//   · 23/09 (folha de recusa restaurada): "o botão ficou muito abaixo, eu
//     poderia ter clicado em fechar sem querer" — o "fechar" é o BACK da barra
//     de 3 botões do Android, que fica logo abaixo do botão de confirmar.
//
// Por que UMA função e não um número em cada tela: eram 5 fórmulas diferentes
// (`spacing.md + inset`, `spacing.lg + max(inset, spacing.lg)`, `inset` cru…) e
// a tela que ele testou por último era sempre a que não tinha recebido o ajuste
// da anterior. A régua agora é uma só e vale pra qualquer folha do app.
//
// A conta é MONOTÔNICA de propósito (mais folga, nunca menos): dentro de um
// `<Modal>` do Android o inset do provider da raiz pode chegar 0 (a folha é
// outra janela), a barra de gestos tem 24 dp e a de 3 botões tem 48 dp. Sem o
// aparelho na mão não dá pra saber qual das três está em jogo — e o piso na
// altura da barra de 3 botões resolve as três.
// ============================================================================
import { spacing } from "@/constants/theme";

/** Altura da barra de navegação de 3 botões do Android, em dp. */
export const BARRA_NAV_ANDROID = 48;

/** Respiro entre o botão de confirmar e a barra do sistema (ou o inset). */
export const RESPIRO_DA_FOLHA = spacing.xl + spacing.sm;

/**
 * `paddingBottom` da folha. Recebe `insets.bottom` do safe-area e devolve o
 * que a folha deixa embaixo: nunca menos que a barra de 3 botões + respiro.
 *
 * ⚠️ Inset inválido (NaN, negativo, undefined em teste) conta como 0 — o piso
 * segura. Jamais devolve menos que `BARRA_NAV_ANDROID + RESPIRO_DA_FOLHA`.
 */
export function fundoDaFolha(insetBottom: number | undefined): number {
  const inset = typeof insetBottom === "number" && Number.isFinite(insetBottom) && insetBottom > 0
    ? insetBottom
    : 0;
  return Math.max(inset, BARRA_NAV_ANDROID) + RESPIRO_DA_FOLHA;
}
