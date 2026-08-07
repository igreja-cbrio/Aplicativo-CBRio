// ============================================================================
// VERSÃO DO APP · a régua do piso mínimo (Onda 3 · 07/08/2026)
//
// O achado: `runtimeVersion.policy = "appVersion"` + `version 1.0.0` significa
// que, no dia em que a version subir, TODO binário 1.0.0 para de receber OTA.
// Provado ao vivo no manifesto: `expo-runtime-version: 1.0.0` → 200 com bundle ·
// `1.0.1` → **HTTP 204**. O app não quebra — CONGELA no último bundle, e o
// portão de atualização nunca mais dispara (ele só age com `isUpdatePending`).
// Dali em diante o único jeito de falar com aquele aparelho é a LOJA.
//
// ⚠️ Quem identifica o BINÁRIO é `Updates.runtimeVersion` (vem do plist/meta-data
// compilado no build). `Constants.expoConfig.version` é a versão do BUNDLE (a
// que veio no OTA) e é "1.0.0" em 100% dos eventos — nunca serviu pra isso.
// ============================================================================

/** Quebra "1.0.3" → [1,0,3]. Trecho não-numérico vira 0 (não explode). */
function partes(v: string): number[] {
  return String(v)
    .trim()
    .split(".")
    .map((p) => {
      const n = Number.parseInt(p, 10);
      return Number.isFinite(n) && n >= 0 ? n : 0;
    });
}

/**
 * -1 se `a < b` · 0 se iguais · 1 se `a > b`.
 *
 * ⚠️ Compara por POSIÇÃO, não por string: "1.0.10" é MAIOR que "1.0.9", e
 * comparação de texto diria o contrário — o erro clássico que faria o piso
 * bloquear quem está atualizado.
 * ⚠️ Comprimento diferente é tratado como zero à direita: "1.0" == "1.0.0".
 * O App Store Connect exibe a versão viva do app como **"1.0"** enquanto o
 * `app.json` diz **"1.0.0"** — se isso contasse como diferente, o piso
 * bloquearia a base inteira.
 */
export function compararVersoes(a: string, b: string): -1 | 0 | 1 {
  const pa = partes(a);
  const pb = partes(b);
  const n = Math.max(pa.length, pb.length);
  for (let i = 0; i < n; i++) {
    const x = pa[i] ?? 0;
    const y = pb[i] ?? 0;
    if (x < y) return -1;
    if (x > y) return 1;
  }
  return 0;
}

/**
 * Esta versão está ABAIXO do piso?
 *
 * ⚠️⚠️ FAIL-OPEN em tudo que for desconhecido: sem versão local, sem piso, ou
 * piso em formato estranho ⇒ **false** (não bloqueia). Trancar a pessoa fora do
 * app por causa de um dado que a gente não conseguiu ler é o pior desfecho
 * possível — é o oposto do que o portão existe pra fazer. Quem decide bloquear
 * é uma configuração que alguém ligou de propósito, nunca uma dúvida.
 */
export function abaixoDoPiso(
  versaoAtual: string | null | undefined,
  piso: string | null | undefined,
): boolean {
  if (!versaoAtual || !piso) return false;
  if (!/^\d+(\.\d+)*$/.test(String(versaoAtual).trim())) return false;
  if (!/^\d+(\.\d+)*$/.test(String(piso).trim())) return false;
  return compararVersoes(versaoAtual, piso) === -1;
}
