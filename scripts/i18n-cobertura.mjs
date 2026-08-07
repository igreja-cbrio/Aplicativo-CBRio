// ============================================================================
// COBERTURA DO i18n · o portão que faltava (07/08/2026)
//
// ⚠️⚠️ POR QUE ISTO EXISTE, E POR QUE É UM TETO E NÃO UM ZERO.
// A varredura de 07/08 achou ~394 strings em português DURAS em 48 telas — não
// era dívida de duas telas, era dívida do app inteiro. E o caso que decidiu a
// forma do conserto: `grupo-visita.tsx` nasceu NAQUELE MESMO DIA com strings
// soltas num arquivo que JÁ importava `useT`. Ou seja, a torneira estava
// aberta: varrer as telas uma a uma é enxugar gelo enquanto código novo entra
// sem tradução, porque `npm run verificar` cobre RÉGUA e não vê tela nenhuma.
//
// Este script mede duas coisas e falha se qualquer uma PIORAR:
//   1. CHAVE SEM TRADUÇÃO — string dentro de `t("…")` que não está em
//      `lib/translations.ts`. O `translate()` cai no português (`?? pt`), então
//      isso NUNCA quebra a tela — some em silêncio, que é justamente por que
//      passou despercebido por meses.
//   2. STRING SOLTA — texto visível em prop/JSX/Alert que nunca passou por `t`.
//
// O teto DESCE conforme a dívida é paga (é só baixar os números aqui). Ele
// nunca sobe: código novo em português duro para o portão. Transformar 394
// invisíveis em 394 que NÃO CRESCEM vale mais do que uma varredura heroica que
// volta a apodrecer na semana seguinte.
//
// ⚠️ O contador é HEURÍSTICO e é PISO, não teto real: não lê template literal
// nem nó JSX com `{}` interpolado. Serve pra ORDENAR e pra travar o
// crescimento — nunca como meta contratual de "i18n concluído".
// ============================================================================
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const RAIZ = process.cwd();

// ⚠️⚠️ ESTES NÚMEROS SÃO A DÍVIDA MEDIDA HOJE (07/08/2026), NÃO UM ALVO.
// Eles **só descem**. Quem paga um pedaço da dívida baixa o número aqui; quem
// escreve tela nova em português duro esbarra no portão e traduz na hora.
//
// Primeira medição: 405 chaves sem tradução e 36 strings soltas em 90 telas.
// Depois de fechar perfil, escala-supervisor, grupo-visita e grupo-editar
// (Onda 2/3): **293 e 36**. O grosso do que sobra é `completar-cadastro.tsx`
// (~40 chaves) e o resto espalhado — ver a listagem que este script imprime.
const TETO_SEM_TRADUCAO = 293;
const TETO_SOLTAS = 36;

function varrer(dir, saida = []) {
  for (const nome of readdirSync(dir)) {
    if (nome === "node_modules" || nome === ".git" || nome === ".expo") continue;
    const p = join(dir, nome);
    if (statSync(p).isDirectory()) varrer(p, saida);
    else if (nome.endsWith(".tsx")) saida.push(p);
  }
  return saida;
}

const arquivos = [join(RAIZ, "app"), join(RAIZ, "components")].flatMap((d) => varrer(d));

// ── 1. chaves usadas em t("…") × dicionário ────────────────────────────────
const dicionario = readFileSync(join(RAIZ, "lib", "translations.ts"), "utf8");
/** A chave é a própria frase em PORTUGUÊS (ver `lib/i18n.ts`). */
function noDicionario(chave) {
  // As chaves do arquivo são literais entre aspas duplas seguidas de `:`.
  const escapado = chave.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`"${escapado}"\\s*:`).test(dicionario);
}

const semTraducao = new Map(); // chave -> [arquivos]
const soltasPorArquivo = [];

const RE_T = /\bt\(\s*"((?:[^"\\]|\\.)*)"\s*\)/g;
const RE_PROP = /(?:label|title|placeholder|accessibilityLabel|accessibilityHint|sheetLabel)="([^"]*[A-Za-zÀ-ÿ][^"]*)"/g;
const RE_JSX = />\s*([A-ZÀ-Ú][^<>{}\n]{2,})\s*</g;
const RE_ALERT = /Alert\.alert\(\s*"([^"]+)"(?:\s*,\s*"([^"]+)")?/g;

for (const arq of arquivos) {
  const rel = relative(RAIZ, arq).replace(/\\/g, "/");
  const src = readFileSync(arq, "utf8");

  for (const m of src.matchAll(RE_T)) {
    const chave = m[1];
    if (!chave.trim() || noDicionario(chave)) continue;
    if (!semTraducao.has(chave)) semTraducao.set(chave, []);
    semTraducao.get(chave).push(rel);
  }

  let soltas = 0;
  for (const re of [RE_PROP, RE_JSX, RE_ALERT]) {
    for (const m of src.matchAll(re)) {
      for (const g of m.slice(1)) if (g && g.trim() && !g.trim().startsWith("//")) soltas += 1;
    }
  }
  if (soltas) soltasPorArquivo.push([soltas, rel]);
}

soltasPorArquivo.sort((a, b) => b[0] - a[0]);
const totalSoltas = soltasPorArquivo.reduce((s, [n]) => s + n, 0);

console.log(`\ni18n · ${arquivos.length} telas varridas`);
console.log(`  chaves sem tradução: ${semTraducao.size}  (teto ${TETO_SEM_TRADUCAO})`);
console.log(`  strings soltas:      ${totalSoltas}  (teto ${TETO_SOLTAS})`);

if (semTraducao.size) {
  console.log("\n  Chaves que caem no português em EN/ES (o `?? pt` esconde isto):");
  for (const [chave, arqs] of [...semTraducao].slice(0, 40)) {
    console.log(`    · "${chave}"  ← ${arqs[0]}`);
  }
  if (semTraducao.size > 40) console.log(`    … e mais ${semTraducao.size - 40}`);
}

if (soltasPorArquivo.length) {
  console.log("\n  Telas com mais texto em português duro:");
  for (const [n, rel] of soltasPorArquivo.slice(0, 10)) console.log(`    ${String(n).padStart(3)}  ${rel}`);
}

let falhou = false;
if (semTraducao.size > TETO_SEM_TRADUCAO) {
  console.error(`\n✗ ${semTraducao.size} chaves sem tradução (teto ${TETO_SEM_TRADUCAO}). Acrescente em lib/translations.ts.`);
  falhou = true;
}
if (totalSoltas > TETO_SOLTAS) {
  console.error(`\n✗ ${totalSoltas} strings soltas (teto ${TETO_SOLTAS}). Envolva em t() — o teto só desce.`);
  falhou = true;
}
if (falhou) process.exit(1);
console.log("\nok · a dívida de i18n não cresceu.\n");
