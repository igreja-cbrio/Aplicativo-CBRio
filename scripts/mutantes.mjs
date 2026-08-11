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
  {
    // ⚠️ A validação de nascimento morava dentro de `completar-cadastro.tsx` e
    // aceitava 31/02 (só conferia dia 1..31). Como .tsx não roda no CI, ninguém
    // pegaria a volta: bastaria "simplificar" tirando o `isValidDateBR` pra a
    // porta que TODO mundo atravessa voltar a mandar data impossível pro
    // servidor — e a pessoa levar 400 seco no meio do cadastro.
    nome: "nascimento: aceitar data que nao existe (tirar o calendario real)",
    arq: "lib/validators.ts",
    de: "  if (!isValidDateBR(br)) return null;",
    para: "  // mutante",
  },
  {
    // ⚠️ ESTE É O BUG DE 07/08, congelado. `Disponibilidade.tsx` validava as
    // datas em que o voluntario NAO pode servir com a regua de NASCIMENTO, que
    // termina em `<= Date.now()` — entao TODA data futura era recusada e a tela
    // dizia "Data de inicio invalida" pra 09/08/2026 e 20/10/2026. Trocar o
    // calendario puro pela regua de nascimento aqui parece consolidacao
    // inocente ("sao duas funcoes quase iguais") e reintroduz o bug inteiro.
    nome: "indisponibilidade: validar data futura com a regua de NASCIMENTO",
    arq: "lib/validators.ts",
    de: "  if (!isDataCalendarioBR(de)) return { ok: false, erro: \"de_invalida\" };",
    para: "  if (!isValidDateBR(de)) return { ok: false, erro: \"de_invalida\" };",
  },
  {
    // ⚠️ Cortar a janela pelo INICIO em vez do FIM: viagem que comecou ontem e
    // termina semana que vem passa a ser recusada, e e justamente o bloqueio
    // que ainda protege a escala futura.
    nome: "indisponibilidade: cortar a janela pelo INICIO em vez do fim",
    arq: "lib/validators.ts",
    de: "  if (isoAte < hoje) return { ok: false, erro: \"janela_passada\" };",
    para: "  if (isoDe < hoje) return { ok: false, erro: \"janela_passada\" };",
  },
  {
    // ⚠️ O CRASH DA ABA SERVIR (07/08), congelado. Topico FIXO faz
    // `RealtimeClient.channel()` REAPROVEITAR o canal ja registrado, e
    // `RealtimeChannel.on()` LANCA em canal joined/joining — a 2a montagem da
    // tela derrubava a arvore inteira ate o Error Boundary. "Simplificar" o
    // topico de volta parece limpeza (o sufixo nao tem significado obvio) e
    // reintroduz o bug exato que a telemetria registrou 2 vezes.
    nome: "realtime: voltar ao topico FIXO do canal de voluntariado",
    arq: "lib/canalRealtime.ts",
    de: "  return `${prefixoVoluntariado(membroId)}-${Date.now()}-${sequencia}`;",
    para: "  return prefixoVoluntariado(membroId);",
  },
  {
    // ⚠️ O supabase-js registra os topicos com o prefixo `realtime:`. Comparar
    // sem tirar o prefixo nao casa NADA: a limpeza vira decoracao e os canais
    // orfaos acumulam a cada abertura da tela (vazamento silencioso).
    nome: "realtime: ignorar o prefixo `realtime:` ao achar canal orfao",
    arq: "lib/canalRealtime.ts",
    de: "    const semPrefixo = t.startsWith(\"realtime:\") ? t.slice(\"realtime:\".length) : t;",
    para: "    const semPrefixo = t;",
  },
  {
    // ⚠️ Sem o corte no limite, o campo volta a aceitar telefone de qualquer
    // tamanho e quem recusa e o SERVIDOR, no fim do cadastro, sem a pessoa
    // saber por que. Foi o relato do Marcos em 07/08.
    nome: "telefone: aceitar telefone de qualquer tamanho (tirar o limite)",
    arq: "lib/telefone.ts",
    de: "  return valorDigitado.replace(/\\D/g, \"\").slice(0, limiteDigitos(dial));",
    para: "  return valorDigitado.replace(/\\D/g, \"\");",
  },
  {
    // ⚠️⚠️ FAIL-OPEN do piso de versao. Sem esta guarda, versao local ilegivel
    // (ou piso ausente) passaria a BLOQUEAR — trancar gente fora do app por
    // causa de um dado que nao deu pra ler e o pior desfecho possivel, e o
    // oposto do que o portao existe pra fazer.
    nome: "versao: bloquear quando o dado esta faltando (tirar o fail-open)",
    arq: "lib/versaoApp.ts",
    de: "  if (!versaoAtual || !piso) return false;",
    para: "  if (!versaoAtual || !piso) return true;",
  },
  {
    // ⚠️ Comparar versao como TEXTO diz que "1.0.10" < "1.0.9" — o piso passaria
    // a bloquear justamente quem esta atualizado.
    nome: "versao: comparar como texto em vez de por posicao",
    arq: "lib/versaoApp.ts",
    de: "    if (x < y) return -1;",
    para: "    if (String(x) < String(y)) return -1;",
  },
  {
    // ⚠️ Padding NEGATIVO no RN puxa o conteudo pra FORA da tela: trocaria
    // "campo coberto pelo teclado" por "campo cortado". O `max(0, ...)` e o
    // que torna a regua auto-corretiva no Android que ainda redimensiona.
    nome: "teclado: folga negativa quando o container esta acima do teclado",
    arq: "lib/teclado.ts",
    de: "  const bruta = Math.max(0, fundoDoContainer - topoDoTeclado);",
    para: "  const bruta = fundoDoContainer - topoDoTeclado;",
  },
  {
    // ⚠️⚠️ ESTE E O MUTANTE QUE DA SENTIDO AO INTERRUPTOR "estive presente".
    // O KPI real (`_kpi_agregar_dado`, ramo lideres_acompanhados) conta a visita
    // SEM olhar `status` — entao gravar linha quando a pessoa NAO esteve
    // presente faz o indicador voltar a medir "digitou" em vez de "foi la",
    // que e exatamente o que o Marcos aprovou evitar.
    nome: "visita: gravar visita mesmo sem ter estado presente",
    arq: "lib/visitaSupervisao.ts",
    de: "  if (!presente) return { gravar: false };",
    para: "  // mutante",
  },
  {
    // ⚠️ 7 dos 87 grupos ativos tem `supervisor_id == lider_id`. Se supervisor
    // ganhasse a precedencia, esses lideres cairiam na tela enxuta e perderiam
    // Pedidos, Estudos e Editar do PROPRIO grupo.
    nome: "papel: mandar quem NAO e supervisor pra tela enxuta",
    arq: "lib/papelGrupo.ts",
    de: '  return papel === "supervisor" ? ROTA_VISITA : ROTA_GESTAO;',
    para: '  return papel === "lider" ? ROTA_GESTAO : ROTA_VISITA;',
  },
  {
    // ⚠️ FAIL-CLOSED. Sem o teto, um crash no meio do cadastro deixa a bandeira
    // ligada pra sempre: o portao NUNCA decide e a pessoa entra no app SEM
    // ficha — exatamente o que o portao existe pra impedir.
    nome: "cadastro em andamento: bandeira sem teto (portao nunca decide)",
    arq: "lib/cadastroEmAndamento.ts",
    de: "  }, TETO_MS);",
    para: "  }, 100000000);",
  },
  // ── Capa do grupo (07/08) · a capa nunca gravou pra ninguém: 0 de 278 ──
  {
    nome: "capa: CHUTAR image/jpeg quando o formato e desconhecido",
    arq: "lib/capaGrupo.ts",
    de: '  return (ext && POR_EXTENSAO[ext]) || null;',
    para: '  return (ext && POR_EXTENSAO[ext]) || "image/jpeg";',
  },
  {
    nome: "capa: voltar a derivar o formato da URI (o `content://` do Android)",
    arq: "lib/capaGrupo.ts",
    de: '  if ((TIPOS_CAPA as readonly string[]).includes(m)) return m as TipoCapa;',
    para: '  if ((TIPOS_CAPA as readonly string[]).includes("nada")) return m as TipoCapa;',
  },
  {
    nome: "capa: recusar envio quando o tamanho e desconhecido (fail-closed)",
    arq: "lib/capaGrupo.ts",
    de: '  if (typeof bytes !== "number" || !Number.isFinite(bytes) || bytes <= 0) return true;',
    para: '  if (typeof bytes !== "number" || !Number.isFinite(bytes) || bytes <= 0) return false;',
  },
  // ── Push (07/08) · zero token no Android, escondido por um console.log ──
  {
    nome: "push: conferir permissao ANTES de credencial (o achado se disfarca)",
    arq: "lib/motivoPush.ts",
    de: '  if (texto.includes("fcm-credentials") || texto.includes("firebase")) return "credencial_fcm";',
    para: '  if (texto.includes("permission")) return "permissao"; if (texto.includes("firebase")) return "credencial_fcm";',
  },
  {
    nome: "push: falha desconhecida virar `permissao` em vez de `outro`",
    arq: "lib/motivoPush.ts",
    de: '  if (texto.includes("projectid") || texto.includes("project id")) return "sem_project_id";',
    para: '  if (texto.includes("projectid") || texto.includes("project id")) return "sem_project_id";\n  return "permissao";',
  },
  // ── Lote de push (07/08) · 1.801 de 1.820 tickets recusados, 98,9% ──
  {
    nome: "lote: voltar a misturar apps Expo no mesmo request",
    arq: "lib/pushLotes.ts",
    de: "    const proj = projetoDe(t);",
    para: '    const proj = "todos";',
  },
  {
    nome: "lote: juntar os DESCONHECIDOS num lote so (reproduz o bug)",
    arq: "lib/pushLotes.ts",
    de: "  for (const t of desconhecidos) lotes.push([t]);",
    para: "  if (desconhecidos.length) lotes.push(desconhecidos);",
  },
  {
    nome: "lote: ignorar o teto de 100 por request",
    arq: "lib/pushLotes.ts",
    de: "    for (let i = 0; i < lista.length; i += teto) lotes.push(lista.slice(i, i + teto));",
    para: "    lotes.push(lista);",
  },
  {
    nome: "lote: apagar token por QUALQUER erro (zeraria a tabela)",
    arq: "lib/pushLotes.ts",
    de: '  return String(errorCode ?? "").trim() === "DeviceNotRegistered";',
    para: '  return !!String(errorCode ?? "").trim();',
  },
  // ── "Nao sei" nao pode virar "nao" (07/08 · Onda 4) ──
  {
    nome: "falha: erro SEM status virar `servidor` em vez de `conexao`",
    arq: "lib/falhaDeLeitura.ts",
    de: "  if (!Number.isFinite(n)) return \"conexao\";",
    para: "  if (!Number.isFinite(n)) return \"servidor\";",
  },
  // ── Porta unica (11/08 · item 14) ──
  {
    nome: "porta: o SOS virar item de lista (2 toques a mais ate o socorro)",
    arq: "lib/portaUnica.ts",
    de: '    tipo: "aconselhamento",',
    para: '    tipo: "sos" as never,',
  },
  {
    nome: "porta: exigir texto pra conversar com pastor (barreira onde nao havia)",
    arq: "lib/portaUnica.ts",
    de: "  if (!opcao.exigeMensagem) return true;",
    para: "  if (false as boolean) return true;",
  },
  // ── Domingo ancora na Home (11/08 · item 9) ──
  {
    nome: "home: domingo lido em UTC (em UTC-3 vira sabado e nunca ancora)",
    arq: "lib/homeCultos.ts",
    de: "  const d = new Date(`${s}T12:00:00`);",
    para: "  const d = new Date(s);",
  },
  {
    nome: "home: destaque volta a ser o primeiro (domingo deixa de ancorar)",
    arq: "lib/homeCultos.ts",
    de: "  return domingo >= 0 ? domingo : 0;",
    para: "  return 0;",
  },
  // ── Busca sem acento na chamada (10/08 · item 1) ──
  {
    nome: "busca: parar de ignorar acento ('joao' nao acha 'Joao')",
    arq: "lib/buscaTexto.ts",
    de: "normalize(\"NFD\")",
    para: "normalize(\"NFC\")",
  },
  {
    nome: "busca: termo vazio deixar de casar (a chamada abre vazia)",
    arq: "lib/buscaTexto.ts",
    de: "  if (!t) return true;",
    para: "  if (!t) return false;",
  },
  // ── Nao perder o que foi digitado (10/08 · item 15) ──
  {
    nome: "rascunho: perguntar SEMPRE (atrito que ensina a dispensar a pergunta)",
    arq: "lib/descartarRascunho.ts",
    de: "  return campos.some((c) => String(c ?? \"\").trim().length > 0);",
    para: "  return true;",
  },
  {
    nome: "rascunho: espaco em branco virar rascunho",
    arq: "lib/descartarRascunho.ts",
    de: '  return campos.some((c) => String(c ?? "").trim().length > 0);',
    para: '  return campos.some((c) => String(c ?? "").length > 0);',
  },
  {
    nome: "rascunho: FECHAR no meio do envio (a pessoa reenvia e duplica)",
    arq: "lib/descartarRascunho.ts",
    de: '  if (args.salvando) return "aguardar";',
    para: '  if (args.salvando) return "fechar";',
  },
  // ── Link de convite (10/08 · Onda C) ──
  {
    // ⚠️ O mutante antigo travava o fallback pro link geral em grupo 'fechado'.
    // O Marcos derrubou essa regra em 11/08 (o lider TEM que poder convidar), e
    // a ancora sumiu junto. O que sobra pra proteger e o link VAZIO.
    nome: "convite: montar `?grupo=` sem id (link quebrado no WhatsApp do lider)",
    arq: "lib/convite.ts",
    de: "  if (!id) return BASE_INSCRICAO;",
    para: "  if (false as boolean) return BASE_INSCRICAO;",
  },
  {
    nome: "convite: texto nao acompanha o link (manda achar na lista o que ja veio pronto)",
    arq: "lib/convite.ts",
    de: "  return linkDeInscricao(grupo) === BASE_INSCRICAO;",
    para: "  return true;",
  },
  // ── Data E HORA na previa (10/08) ──
  {
    nome: "data: voltar a mostrar relativo ('Em N dias') em vez de dia e mes",
    arq: "lib/proximoEncontro.ts",
    de: "  return hora ? `${dia} · ${hora}` : dia;",
    para: "  return hora ? `em breve · ${hora}` : \"em breve\";",
  },
  {
    nome: "data: inventar meia-noite quando nao ha hora",
    arq: "lib/proximoEncontro.ts",
    de: '  if (!horario) return "";',
    para: '  if (!horario) return "00:00";',
  },
  // ── Ficha: nao repergunte (10/08 · apontamento 4) ──
  {
    nome: "ficha: `!!campo` em vez da validacao real (telefone de 8 digitos passa)",
    arq: "lib/ficha.ts",
    de: "  return !faltaNaFicha(m).includes(CAMPOS_CONTRATO[campo]);",
    para: "  return !!(m as Record<string, unknown> | null | undefined)?.[campo];",
  },
  // ── QR do cartao (10/08 · Onda B) ──
  {
    nome: "qr: erro deixar de vir ANTES (manda completar cadastro que ja esta certo)",
    arq: "lib/cartaoQr.ts",
    de: '  if (args.falhou) return "erro";',
    para: '  if (false as boolean) return "erro";',
  },
  {
    nome: "qr: desenhar QR fora do estado ok (quadrado preto no leitor)",
    arq: "lib/cartaoQr.ts",
    de: '  return estado === "ok";',
    para: "  return true;",
  },
  {
    nome: "falha: deixar a falha virar CONTEUDO na tela",
    arq: "lib/falhaDeLeitura.ts",
    de: "export function podeVirarConteudo(_motivo: MotivoFalha): boolean {",
    para: "export function podeVirarConteudo(_motivo: MotivoFalha): boolean {\n  return true;",
  },
  {
    nome: "lote: parar de deduplicar (2 notificacoes no mesmo aparelho)",
    arq: "lib/pushLotes.ts",
    de: "    if (!tok || vistos.has(tok)) continue;",
    para: "    if (!tok) continue;",
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
