// ============================================================================
// A CATRACA DO BINÁRIO DA LOJA (03/09/2026)
//
// POR QUE EXISTE (incidente medido em 03/09): o Marcos relatou que quem baixava
// o app da loja caía numa versão sem validação de CPF e sem as abas novas. Não
// era o OTA quebrado. **A loja não serve "o último OTA" — ela serve um BINÁRIO,
// e cada binário carrega o bundle de JS congelado no dia em que foi compilado.**
// O que estava publicado era o iOS build 33 de 22/06 (192 commits atrás) e o
// Android versionCode 5 de 24/07 (159 commits). Builds mais novos EXISTIAM no
// EAS — o iOS 41 e as vc 6 e 7 — mas nunca chegaram à loja pública.
//
// ⚠️⚠️ E O PIOR: a régua de `lib/portaoUpdate.ts` (que conserta a primeira
// abertura depois de instalar) rodava a partir do bundle EMBUTIDO, então ficou
// MORTA em campo por 5 dias — o conserto existia no repo e não alcançava
// ninguém. Nenhum sinal apontava isso: o OTA saía verde, o EAS mostrava builds
// recentes, e o app dos que já tinham instalado estava em dia.
//
// ⚠️ POR QUE A UNIDADE NÃO É "A CADA N OTAs" (decisão do Marcos, 03/09): contar
// OTA mede VOLUME de publicação, não DISTÂNCIA. Um OTA que troca uma string não
// envelhece o binário; um que adiciona uma aba ou mexe no cadastro envelhece
// muito. As réguas que importam são três: distância do embutido (dias/commits),
// mudança NATIVA pendente (que o OTA não entrega de jeito nenhum) e a cadência
// de 2 semanas, ancorada no ciclo de revisão da Apple.
//
// ⚠️⚠️ FAIL-OPEN em tudo que for desconhecido, pela mesma lei de
// `lib/versaoApp.ts`: ledger ausente, commit fora do clone, JSON ilegível ⇒
// AVISA e deixa publicar. Travar um hotfix por causa de um dado que a gente não
// conseguiu ler é o pior desfecho possível. Só BLOQUEIA com fato na mão.
// ============================================================================
'use strict';

const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

/**
 * Os limites. `aviso` é a cadência combinada (2 semanas ≈ 30 commits no ritmo
 * atual do repo); `bloqueio` é o teto onde a distância já reproduz o incidente.
 */
const LIMITES = {
  avisoDias: 14,
  avisoCommits: 30,
  bloqueioDias: 30,
  bloqueioCommits: 60,
};

// ── Régua PURA · é o que o teste cobra ──────────────────────────────────────

/**
 * Que veredito a distância merece?
 *
 * @param {{diasAtras?: number|null, commitsAtras?: number|null, mudouNativo?: boolean|null}} e
 * @param {typeof LIMITES} [limites]
 * @returns {{nivel: 'ok'|'aviso'|'bloqueio'|'desconhecido', motivos: string[]}}
 *
 * ⚠️ `mudouNativo` é BLOQUEIO sozinho, sem olhar distância. Mudança nativa
 * (dependência com código nativo, plugin, permissão, entitlement) não viaja por
 * OTA: o pacote novo chega a um binário que NÃO tem aquele código nativo. Hoje,
 * com `runtimeVersion.policy = appVersion` travado em 1.0.0, o manifesto entrega
 * mesmo assim — e o desfecho é CRASH na abertura, não desatualização.
 * ⚠️ `mudouNativo === null` (não deu pra conferir) NÃO bloqueia — só entra como
 * motivo. É a diferença entre "medi e está errado" e "não consegui medir".
 */
function avaliarDrift(e, limites = LIMITES) {
  const dias = Number.isFinite(e && e.diasAtras) ? e.diasAtras : null;
  const commits = Number.isFinite(e && e.commitsAtras) ? e.commitsAtras : null;
  const nativo = e && typeof e.mudouNativo === 'boolean' ? e.mudouNativo : null;
  const motivos = [];

  if (nativo === true) {
    motivos.push('há mudança NATIVA desde o binário publicado — OTA não entrega isso, e com runtimeVersion travado em 1.0.0 o pacote chega a um binário sem o nativo (crash, não desatualização)');
  }
  if (nativo === null) {
    motivos.push('não deu pra conferir mudança nativa (fail-open: não bloqueia por isso)');
  }

  // Nada medido ⇒ desconhecido. Avisa, nunca bloqueia.
  if (dias === null && commits === null) {
    motivos.push('não deu pra medir a distância do binário publicado (ledger ou commit-base ausente)');
    return { nivel: nativo === true ? 'bloqueio' : 'desconhecido', motivos };
  }

  if (dias !== null) motivos.push(`${dias} dia(s) desde o binário publicado`);
  if (commits !== null) motivos.push(`${commits} commit(s) à frente do binário publicado`);

  const estourouTeto =
    (dias !== null && dias >= limites.bloqueioDias) ||
    (commits !== null && commits >= limites.bloqueioCommits);
  if (nativo === true || estourouTeto) return { nivel: 'bloqueio', motivos };

  const passouCadencia =
    (dias !== null && dias >= limites.avisoDias) ||
    (commits !== null && commits >= limites.avisoCommits);
  if (passouCadencia) return { nivel: 'aviso', motivos };

  return { nivel: 'ok', motivos };
}

/**
 * O que mudou de NATIVO entre dois pares (package.json, app.json)?
 *
 * Régua PURA, conservadora de propósito: na dúvida ela ACUSA. Preferimos um
 * build a mais do que um OTA que entrega JS pedindo nativo que não existe.
 *
 * ⚠️ Qualquer add/remove/bump em `dependencies` conta. Não existe jeito
 * confiável de saber, só pelo nome, se um pacote tem código nativo — e a lista
 * de exceções ficaria desatualizada exatamente quando importasse.
 * ⚠️ No `app.json` só olhamos o que virou binário: `plugins`, permissões do
 * Android, entitlements/infoPlist do iOS e o `googleServicesFile`. Mudar `name`
 * ou `splash` não exige build (o OTA carrega).
 *
 * @param {{pkgAntes?: any, pkgAgora?: any, appAntes?: any, appAgora?: any}} p
 * @returns {string[]} itens mudados (vazio = nada nativo mudou)
 */
function diffNativo(p) {
  const itens = [];
  const depsAntes = (p.pkgAntes && p.pkgAntes.dependencies) || {};
  const depsAgora = (p.pkgAgora && p.pkgAgora.dependencies) || {};
  const chaves = new Set([...Object.keys(depsAntes), ...Object.keys(depsAgora)]);
  for (const k of [...chaves].sort()) {
    const a = depsAntes[k];
    const b = depsAgora[k];
    if (a === b) continue;
    if (a === undefined) itens.push(`dependência NOVA: ${k}@${b}`);
    else if (b === undefined) itens.push(`dependência REMOVIDA: ${k}`);
    else itens.push(`dependência mudou: ${k} ${a} → ${b}`);
  }

  const expoAntes = (p.appAntes && p.appAntes.expo) || {};
  const expoAgora = (p.appAgora && p.appAgora.expo) || {};
  const secoes = [
    ['plugins', (x) => x.plugins],
    ['android.permissions', (x) => x.android && x.android.permissions],
    ['android.googleServicesFile', (x) => x.android && x.android.googleServicesFile],
    ['ios.entitlements', (x) => x.ios && x.ios.entitlements],
    ['ios.infoPlist', (x) => x.ios && x.ios.infoPlist],
  ];
  for (const [nome, ler] of secoes) {
    const a = JSON.stringify(ler(expoAntes) ?? null);
    const b = JSON.stringify(ler(expoAgora) ?? null);
    if (a !== b) itens.push(`app.json · ${nome} mudou`);
  }
  return itens;
}

// ── Coleta (impura) · git + ledger ──────────────────────────────────────────

function git(raiz, args) {
  const r = spawnSync('git', args, { cwd: raiz, encoding: 'utf8' });
  if (r.status !== 0) return null;
  return (r.stdout || '').trim();
}

function lerJson(txt) {
  try { return JSON.parse(txt); } catch { return null; }
}

/** O ledger: qual binário está PUBLICADO em cada loja. Fail-open se ilegível. */
function lerLedger(raiz) {
  const p = path.join(raiz, 'loja-publicado.json');
  if (!fs.existsSync(p)) return null;
  return lerJson(fs.readFileSync(p, 'utf8'));
}

/**
 * O commit que corresponde ao binário publicado.
 *
 * ⚠️ Usa `commit` quando o ledger tem — é exato. Cai pro último commit ATÉ a
 * data de publicação quando não tem: o iOS 33 foi compilado FORA do EAS (Xcode,
 * 22/06) e não existe registro de commit pra ele. Aproximar pela data é pior que
 * o hash e muito melhor que não medir.
 */
function resolverCommitBase(raiz, entrada) {
  if (!entrada) return null;
  if (entrada.commit) {
    const ok = git(raiz, ['cat-file', '-e', `${entrada.commit}^{commit}`]);
    if (ok !== null) return entrada.commit;
  }
  if (entrada.publicado_em) {
    const h = git(raiz, ['log', '-1', '--format=%H', `--before=${entrada.publicado_em}T23:59:59`, 'origin/main']);
    if (h) return h;
  }
  return null;
}

/** Mede a distância do commit-base até o HEAD atual. */
function medir(raiz, commitBase) {
  if (!commitBase) return { commitsAtras: null, diasAtras: null };
  const n = git(raiz, ['rev-list', '--count', `${commitBase}..HEAD`]);
  const iso = git(raiz, ['log', '-1', '--format=%cI', commitBase]);
  const commitsAtras = n === null ? null : Number.parseInt(n, 10);
  let diasAtras = null;
  if (iso) {
    const ms = Date.now() - new Date(iso).getTime();
    if (Number.isFinite(ms)) diasAtras = Math.floor(ms / 86400000);
  }
  return {
    commitsAtras: Number.isFinite(commitsAtras) ? commitsAtras : null,
    diasAtras,
  };
}

/** Roda o `diffNativo` com os arquivos de dois pontos do git. `null` = não deu. */
function mudouNativoDesde(raiz, commitBase) {
  if (!commitBase) return { mudou: null, itens: [] };
  const pkgAntes = lerJson(git(raiz, ['show', `${commitBase}:package.json`]) || '');
  const appAntes = lerJson(git(raiz, ['show', `${commitBase}:app.json`]) || '');
  if (!pkgAntes && !appAntes) return { mudou: null, itens: [] };
  const pkgAgora = lerJson(fs.readFileSync(path.join(raiz, 'package.json'), 'utf8'));
  const appAgora = lerJson(fs.readFileSync(path.join(raiz, 'app.json'), 'utf8'));
  const itens = diffNativo({ pkgAntes, pkgAgora, appAntes, appAgora });
  return { mudou: itens.length > 0, itens };
}

/** Avalia as duas lojas. Devolve o pior veredito + o relatório por plataforma. */
function avaliarLojas(raiz, limites = LIMITES) {
  const ledger = lerLedger(raiz);
  const plataformas = ['ios', 'android'];
  const relatorio = [];
  let pior = 'ok';
  const ordem = { ok: 0, desconhecido: 1, aviso: 2, bloqueio: 3 };

  for (const p of plataformas) {
    const entrada = ledger && ledger[p];
    const base = resolverCommitBase(raiz, entrada);
    const { commitsAtras, diasAtras } = medir(raiz, base);
    const nativo = mudouNativoDesde(raiz, base);
    const v = avaliarDrift({ diasAtras, commitsAtras, mudouNativo: nativo.mudou }, limites);
    relatorio.push({
      plataforma: p,
      publicado: entrada || null,
      commitBase: base,
      diasAtras,
      commitsAtras,
      itensNativos: nativo.itens,
      ...v,
    });
    if (ordem[v.nivel] > ordem[pior]) pior = v.nivel;
  }
  return { nivel: pior, relatorio, ledgerAusente: !ledger };
}

/** Imprime o relatório. Devolve o pior nível. */
function relatar(raiz, limites = LIMITES) {
  const { nivel, relatorio, ledgerAusente } = avaliarLojas(raiz, limites);
  const icone = { ok: '✅', desconhecido: '❔', aviso: '⚠️ ', bloqueio: '❌' };
  console.log('');
  console.log('── binário publicado nas lojas ───────────────────────────────');
  if (ledgerAusente) {
    console.log('❔ `loja-publicado.json` não encontrado — sem ele não há como medir.');
  }
  for (const r of relatorio) {
    const quem = r.publicado
      ? `${r.publicado.rotulo || '?'} · publicado em ${r.publicado.publicado_em || '?'}`
      : 'sem registro no ledger';
    console.log(`${icone[r.nivel]} ${r.plataforma.toUpperCase().padEnd(7)} ${quem}`);
    for (const m of r.motivos) console.log(`        · ${m}`);
    for (const i of r.itensNativos.slice(0, 8)) console.log(`        ⚙ ${i}`);
    if (r.itensNativos.length > 8) console.log(`        ⚙ (+${r.itensNativos.length - 8} itens)`);
  }
  console.log(`   cadência combinada: build de loja a cada ${limites.avisoDias} dias / ${limites.avisoCommits} commits · teto ${limites.bloqueioDias} dias / ${limites.bloqueioCommits} commits`);
  console.log('──────────────────────────────────────────────────────────────');
  console.log('');
  return nivel;
}

module.exports = { LIMITES, avaliarDrift, diffNativo, avaliarLojas, relatar };

// `node scripts/driftLoja.js` (via `npm run loja`) imprime e sai 0 sempre —
// relatório não é portão; quem cobra é o `scripts/ota.js`.
if (require.main === module) {
  relatar(path.join(__dirname, '..'));
}
