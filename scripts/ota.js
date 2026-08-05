#!/usr/bin/env node
/**
 * Publica um update OTA no canal production — o ÚNICO caminho que deve ser
 * usado (`npm run ota -- "mensagem"`).
 *
 * ⚠️ POR QUE ESTE SCRIPT EXISTE (incidente 04/08/2026): um `eas update` rodado
 * de um clone SEM `.env` embutiu `EXPO_PUBLIC_SUPABASE_URL/ANON_KEY` VAZIOS no
 * pacote. O app caiu no fallback `placeholder.supabase.co` de lib/supabase.ts e
 * o login com Google quebrou pra quem já tinha baixado o update — o app da loja
 * (build nativo) ficou intacto, mas todo mundo que abriu o app pegou o pacote
 * quebrado. Diagnóstico só apareceu porque o Marcos leu a URL na tela do Google.
 *
 * ⚠️⚠️ A CAUSA REAL (medida, não suposta): **o EAS CLI 21 NÃO LÊ `.env` no
 * `eas update`** — as vars vêm dos EAS environment variables do servidor,
 * selecionadas por `--environment`. Publiquei 2× "com o .env no lugar" e o
 * bundle saiu igualzinho ao quebrado; só com `--environment production` o
 * conteúdo mudou (launchAsset key 47bc9a66 → 86b28c44). Sem a flag, publish
 * de app que usa EXPO_PUBLIC_* SAI QUEBRADO, com ou sem .env.
 *
 * As 2 defesas daqui:
 *  1. `--environment production` SEMPRE → vars do servidor (`eas env:list
 *     production` mostra URL e anon key corretas). Publicar de qualquer
 *     máquina/clone passa a ser seguro.
 *  2. Guarda local: se houver `.env`, conferimos que não está vazio/placeholder
 *     e que aponta pro projeto vivo — o `.env` serve pro dev local (expo start,
 *     que SIM o lê) e um .env errado engana quem for depurar.
 */
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const raiz = path.join(__dirname, '..');
const msg = process.argv.slice(2).join(' ').trim();
if (!msg) {
  console.error('Uso: npm run ota -- "mensagem do update"');
  process.exit(1);
}

// Guarda 1 · .env presente precisa estar SÃO (ele tem precedência sobre o servidor)
const envPath = path.join(raiz, '.env');
if (fs.existsSync(envPath)) {
  const txt = fs.readFileSync(envPath, 'utf8');
  const ler = (k) => (txt.match(new RegExp(`^${k}=(.*)$`, 'm')) || [])[1]?.trim() || '';
  const url = ler('EXPO_PUBLIC_SUPABASE_URL');
  const key = ler('EXPO_PUBLIC_SUPABASE_ANON_KEY');
  const ruim = [];
  if (!url || url.includes('placeholder')) ruim.push('EXPO_PUBLIC_SUPABASE_URL');
  if (!key || key.includes('placeholder') || key.length < 100) ruim.push('EXPO_PUBLIC_SUPABASE_ANON_KEY');
  if (ruim.length) {
    console.error(
      `\n❌ .env presente mas inválido: ${ruim.join(', ')}.\n` +
      '   Publicar assim quebra o login do app (fallback placeholder.supabase.co).\n' +
      '   Conserte o .env ou remova o arquivo (aí as vars vêm do servidor EAS).\n'
    );
    process.exit(1);
  }
  // Alinhamento com o projeto vivo — clone antigo pode ter a URL do projeto
  // Supabase inicial (otzemqml...), que autentica em OUTRO banco.
  if (!url.includes('hhntwfawfnxvuobhdfkb')) {
    console.error(`\n❌ EXPO_PUBLIC_SUPABASE_URL aponta pra ${url} — o projeto vivo é hhntwfawfnxvuobhdfkb.\n`);
    process.exit(1);
  }
}

// ⚠️ PORTÃO ANTES DE PUBLICAR (05/08/2026): `typecheck` + as réguas (vitest).
// OTA vai direto pra quem tem o app instalado — não existe revisão no caminho,
// então o portão TEM que ser aqui. Foi um dia de 12 OTAs sem nenhum teste que
// motivou isto. Pular só com CBRIO_OTA_SEM_PORTAO=1, e isso é para hotfix
// consciente (o motivo aparece no log).
if (process.env.CBRIO_OTA_SEM_PORTAO === '1') {
  console.warn('⚠️  portão IGNORADO por CBRIO_OTA_SEM_PORTAO=1 — publicando sem typecheck/testes');
} else {
  console.log('→ portão: npm run verificar (typecheck + réguas)');
  const gate = spawnSync('npm run verificar', { cwd: raiz, stdio: 'inherit', shell: true });
  if (gate.status !== 0) {
    console.error('');
    console.error('❌ o portão falhou — NADA foi publicado.');
    console.error('   Conserte, ou use CBRIO_OTA_SEM_PORTAO=1 se for hotfix consciente.');
    console.error('');
    process.exit(1);
  }
}

console.log('→ eas update --channel production --environment production');
// ⚠️ shell: true — sem isso o spawn do `npx` FALHA EM SILÊNCIO no Windows
// (Git Bash): o script imprimia a linha acima e saía sem publicar nada.
const r = spawnSync(
  `npx eas-cli update --channel production --environment production --message ${JSON.stringify(msg)} --non-interactive`,
  { cwd: raiz, stdio: 'inherit', shell: true }
);
if (r.error) {
  console.error('❌ não foi possível executar o eas-cli:', r.error.message);
  process.exit(1);
}
process.exit(r.status ?? 1);
