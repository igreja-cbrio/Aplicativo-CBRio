/**
 * Tamanho de letra das telas de LEITURA (Bíblia · devocional do dia · dia do
 * plano). Pedido do Marcos (24/09/2026): "uma opção de aumentar a letra, lá na
 * aba de bíblia também, para as pessoas que precisam".
 *
 * ⚠️ É SEPARADO da escala global de Configurações (`cbrio.fontScale`, que
 * multiplica todo <Text> do app e só vale depois de reabrir): aqui é o A−/A+
 * da própria leitura, vale na hora e só nas telas de leitura. As duas se
 * multiplicam — quem já usa o app em letra grande ganha leitura ainda maior.
 *
 * Régua PURA (sem AsyncStorage) pra entrar no portão; o hook fica em
 * `useFonteLeitura.ts`.
 */
export const PASSOS_FONTE = [0.85, 1, 1.15, 1.3, 1.5] as const;
export const PASSO_PADRAO = 1;
export const CHAVE_FONTE_LEITURA = "cbrio.fonteLeitura";

/** Índice válido de passo, ou o padrão quando o valor guardado é lixo. */
export function normalizarPasso(v: unknown): number {
  const n = typeof v === "string" ? Number(v) : v;
  if (typeof n !== "number" || !Number.isInteger(n) || n < 0 || n >= PASSOS_FONTE.length) return PASSO_PADRAO;
  return n;
}

/** Próximo passo na direção pedida, travado nas pontas (não dá volta). */
export function mudarPasso(atual: number, direcao: -1 | 1): number {
  const base = normalizarPasso(atual);
  return Math.min(PASSOS_FONTE.length - 1, Math.max(0, base + direcao));
}

/** fontSize e lineHeight escalados juntos — escalar só a fonte faz as linhas se sobreporem. */
export function escalar(base: { fontSize: number; lineHeight: number }, passo: number): { fontSize: number; lineHeight: number } {
  const m = PASSOS_FONTE[normalizarPasso(passo)];
  return { fontSize: Math.round(base.fontSize * m), lineHeight: Math.round(base.lineHeight * m) };
}
