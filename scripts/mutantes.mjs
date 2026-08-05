// ============================================================================
// MUTATION GUARDS · prova que os testes de régua têm dente (05/08/2026)
//
// Quebra cada régua DE PROPÓSITO, roda `vitest` e exige que ele FALHE. Guarda
// que não pega a regressão é decoração — e o jeito de saber é este.
//
// Cada mutante abaixo é uma regressão que JÁ ACONTECEU (ou quase) neste app:
//   · tratar status terminal de voluntariado como "pendente" → 88 pessoas
//     apareciam na fila da equipe pra sempre;
//   · status desconhecido virar "pendente" → o mesmo, pra todo status que o ERP
//     criar amanhã;
//   · a seta voltar no HISTÓRICO em vez de subir na árvore → o `cd ..` morre;
//   · dia em UTC → o culto de quarta (20h) saía de "próximos" durante o culto;
//   · parar de exigir CPF → a pessoa preenche tudo e leva 400 do servidor;
//   · esquecer o `sexo` no payload → idem (o contrato exige).
//
// ⚠️ SEMPRE reverte o arquivo, inclusive se o vitest explodir (try/finally).
// ⚠️ Roda no CI (`npm run test:mutantes`). Se um mutante deixar de ser pego,
// **o teste é que está fraco** — conserte o teste, não apague o mutante.
// ============================================================================
import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const MUTANTES = [
  {
    nome: "volStatus: tratar status terminal como pendente",
    arq: "lib/volStatus.ts",
    de: 'const ENCERRADO = new Set(["nao_responde", "nao_pode_ou_duplicata", "desistente"]);',
    para: "const ENCERRADO = new Set<string>([]);",
  },
  {
    nome: "volStatus: status desconhecido virar pendente",
    arq: "lib/volStatus.ts",
    de: '  // Status que o ERP criou e ninguém trouxe pra cá: não inventa "pendente".\n  return "nenhum";',
    para: '  return "pendente";',
  },
  {
    nome: "hierarquia: voltar no histórico (router.back) em vez de subir",
    arq: "lib/hierarquia.ts",
    de: "  router.navigate(pai as Href);",
    para: "  router.back();",
  },
  {
    nome: "dataBRT: usar o dia UTC em vez do dia da igreja",
    arq: "lib/dataBRT.ts",
    de: "return new Date(Date.now() - MS_BRT).toISOString().slice(0, 10);",
    para: "return new Date(Date.now()).toISOString().slice(0, 10);",
  },
  {
    nome: "ficha: parar de exigir CPF (que o servidor exige)",
    arq: "lib/ficha.ts",
    de: 'falta.push(CAMPOS_CONTRATO.cpf);',
    para: "void 0;",
  },
  {
    nome: "payload: esquecer o sexo (campo do contrato)",
    arq: "lib/inscricaoPayload.ts",
    de: '    sexo: membro.genero || "",',
    para: "    sexo: undefined,",
  },
  {
    // ⚠️ A armadilha do falsy: `dia_semana = 0` é DOMINGO. Trocar `== null` por
    // `!diaSemana` (que parece uma simplificação inocente) joga TODO grupo de
    // domingo em "sem dia definido" — e o herói da tela desaparece pra eles.
    // Mesma classe do bug que derivou 58 campos errados no ERP em 29/07.
    nome: "proximoEncontro: tratar domingo (0) como 'sem dia' (falsy)",
    arq: "lib/proximoEncontro.ts",
    de: "  if (diaSemana == null || diaSemana < 0 || diaSemana > 6) return { tipo: \"sem_dia\" };",
    para: "  if (!diaSemana || diaSemana > 6) return { tipo: \"sem_dia\" };",
  },
];

// ⚠️ O working tree deste repo tem arquivos com CRLF (Windows), então casar a
// âncora com LF cru falha — foi o que aconteceu na 1ª execução. A BUSCA aceita
// as duas quebras; a REVERSÃO usa sempre o conteúdo original, byte a byte.
function regexDaAncora(txt) {
  const escapado = txt.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // ⚠️ `split("\n")` com a quebra REAL (0x0A): a âncora tem newline de verdade,
  // não a sequência "\n" de dois caracteres — errar isso fez o mutante 2 nunca
  // casar e o script morrer em "âncora perdida".
  return new RegExp(escapado.split("\n").join("\\r?\\n"));
}

let pegos = 0;
for (const m of MUTANTES) {
  const original = readFileSync(m.arq, "utf8");
  const re = regexDaAncora(m.de);
  if (!re.test(original)) {
    console.error(`\n✗ ÂNCORA PERDIDA em ${m.arq}: o código mudou e este mutante não se aplica mais.`);
    console.error("  Atualize scripts/mutantes.mjs — sem isso o CI deixa de provar a régua.");
    process.exit(1);
  }
  try {
    writeFileSync(m.arq, original.replace(re, m.para), "utf8");
    const r = spawnSync("npx", ["vitest", "run", "--reporter=dot"], {
      stdio: "ignore",
      shell: process.platform === "win32",
    });
    const pegou = r.status !== 0;
    console.log(`${pegou ? "  ok  " : " FURO "} ${m.nome}${pegou ? "" : "  <- o teste NAO pegou!"}`);
    if (pegou) pegos += 1;
  } finally {
    writeFileSync(m.arq, original, "utf8"); // reverte SEMPRE
  }
}

console.log(`\n${pegos}/${MUTANTES.length} mutantes pegos pelas réguas`);
if (pegos !== MUTANTES.length) {
  console.error("Há régua sem guarda de verdade — o teste passa mesmo com a regra errada.");
  process.exit(1);
}
