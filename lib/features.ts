/**
 * Feature flags do app.
 *
 * generosidade: módulo de doações (Doar/Generosidade). DESATIVADO
 * temporariamente (out 2026) — removido da submissão da App Store até a
 * aprovação da Benevity (Apple guideline 3.2.2(iv) · doações p/ nonprofit).
 * ⚠️ NÃO apagar código/telas — só desligado por flag. Reativar = `true`.
 */
export const FEATURES = {
  generosidade: false,
} as const;
