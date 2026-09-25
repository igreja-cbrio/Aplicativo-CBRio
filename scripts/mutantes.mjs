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
    // ⚠️ `replace` "pra não empilhar" é a otimização de boa-fé que destrói a
    // aba a cada toque: voltar pra ela paga montagem nova + a busca do
    // `useFocusEffect` + o spinner. `navigate` volta pra instância viva.
    nome: "barra: trocar navigate por replace (recarrega a aba a cada toque)",
    arq: "lib/nav.ts",
    // ⚠️ Âncora atualizada em 20/08/2026: `irParaBarra` passou a decidir entre
    // o destino e a Home (tocar em Menu no menu volta pra Home). O que este
    // mutante prova continua sendo o mesmo — a barra NUNCA usa `replace`.
    de: '  router.navigate((acao === "home" ? ROTA_HOME : destino) as Href);',
    para: '  router.replace((acao === "home" ? ROTA_HOME : destino) as Href);',
  },
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
    de: '  router.navigate((Object.keys(params).length ? { pathname: pai, params } : pai) as Href);',
    para: "  router.back();",
  },
  {
    nome: "dataBRT: usar o dia UTC em vez do dia da igreja",
    arq: "lib/dataBRT.ts",
    de: "return new Date(Date.now() - MS_BRT).toISOString().slice(0, 10);",
    para: "return new Date(Date.now()).toISOString().slice(0, 10);",
  },
  {
    // ⚠️⚠️ O bug do DOMINGO À NOITE. Culto de 19h é 22h UTC: das 21h BRT em
    // diante `toISOString()` já devolve o dia seguinte, e a janela do check-in
    // FECHA NO MEIO DO CULTO — quando o supervisor está justamente marcando
    // quem chegou. O botão desaparece da mão dele, com gente na porta.
    nome: "janelaCheckin: comparar o dia em UTC (fecha a janela no culto da noite)",
    arq: "lib/janelaCheckin.ts",
    de: 'return d.toLocaleDateString("en-CA", { timeZone: TZ });',
    para: "return d.toISOString().slice(0, 10);",
  },
  {
    // A janela é o DIA do culto. Trocar por "sempre aberta" é o pedido do
    // Matheus ao contrário — e o servidor recusaria com 403, então o app
    // ofereceria um botão que falha.
    nome: "janelaCheckin: janela sempre aberta (ignora o dia do culto)",
    arq: "lib/janelaCheckin.ts",
    de: "return dCulto === dHoje ? { ok: true, dia: dCulto } : { ok: false, motivo: \"fora_do_dia\", dia: dCulto };",
    para: "return { ok: true, dia: dCulto };",
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
    // ⚠️ A GUARDA DE DATA FUTURA DA CHAMADA (21/09/2026). Sem ela o heroi
    // "Proximo encontro · em 3 dias" abre a chamada na data futura, o servidor
    // recusa com 400 e a tela mostra o alerta seco "Nao deu". Tirar a queda pra
    // ocorrencia anterior parece simplificacao ("devolve o alvo e pronto") e
    // reintroduz o defeito inteiro.
    nome: "chamada: deixar a data FUTURA passar pro servidor",
    arq: "lib/chamadaData.ts",
    de: "  if (alvo && alvo <= hoje) return alvo;",
    para: "  if (alvo) return alvo;",
  },
  {
    // ⚠️ Ordenar pelo nome CRU manda "ana paula" pro fim da lista (minuscula
    // depois de maiuscula no ASCII) e "Elida" pra depois de "Zuleica". A lista
    // continua "ordenada" aos olhos de quem testa com 3 nomes ASCII, e quebra
    // no grupo real, que e cheio de acento.
    nome: "roster: ordenar pelo nome cru, sem normalizar acento/caixa",
    arq: "lib/rosterOrdem.ts",
    de: "  const na = normalizarBusca(a);",
    para: "  const na = String(a || \"\");",
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
  // -- Outro responsavel: CPF obrigatorio (11/08) --
  {
    nome: "outro responsavel: CPF deixar de ser obrigatorio (o pai nunca reencontra o cadastro)",
    arq: "lib/apresentacaoCrianca.ts",
    de: '    if (!cpfPareceValido(outro.cpf)) falta.push("CPF do outro responsável");',
    para: '    if (false) falta.push("CPF do outro responsável");',
  },
  {
    nome: "outro responsavel: aceitar 111.111.111-11 como CPF de gente",
    arq: "lib/apresentacaoCrianca.ts",
    de: "  if (d.length !== 11 || /^(\\d)\\1{10}$/.test(d)) return false;",
    para: "  if (d.length !== 11) return false;",
  },
  // ── Apresentacao de crianca (11/08) ──
  {
    nome: "crianca: aceitar 31/02 (data que nao existe iria pro banco)",
    arq: "lib/apresentacaoCrianca.ts",
    de: "  if (d.getFullYear() !== ano || d.getMonth() !== mes - 1 || d.getDate() !== dia) return null;",
    para: "  if (false) return null;",
  },
  {
    nome: "crianca: aviso sem o NOME da familia (caso Benjamin/Mariane)",
    arq: "lib/apresentacaoCrianca.ts",
    de: "    ? `A criança vai entrar na sua família (${familiaNome}) e aparecer em \"Minha família\".`",
    para: "    ? `A criança vai aparecer em \"Minha família\".`",
  },
  // ── /voluntariado/me: o campo que chegava errado calado (11/08) ──
  {
    nome: "me: truthy frouxo em voluntario_ativo (string \"false\" viraria true)",
    arq: "lib/voluntariadoMe.ts",
    de: "  const voluntario_ativo = obj?.voluntario_ativo === true;",
    para: "  const voluntario_ativo = !!obj?.voluntario_ativo;",
  },
  {
    nome: "me: inscricao sem status virar objeto meio-preenchido",
    arq: "lib/voluntariadoMe.ts",
    de: "  if (!status) return null;",
    para: "  if (false) return null;",
  },
  // ── Servir: quem esta escalado nao ve formulario (11/08) ──
  {
    nome: "servir: exigir inscricao de quem JA SERVE (caso Pedro Fernandes)",
    arq: "lib/volStatus.ts",
    de: "  if (voluntarioAtivo === true) return \"ativo\";",
    para: "  if (voluntarioAtivo === true && !!status) return \"ativo\";",
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
  {
    // O botao do cartao renderizava "Add to Apple Wallet" no ANDROID e baixava
    // um .pkpass que o Google Wallet nem abre.
    nome: "carteira: mandar o Android pra Apple Wallet",
    arq: "lib/carteira.ts",
    de: '  if (os === "android") return "google";',
    para: '  if (os === "android") return "apple";',
  },
  {
    // Com a secao "Minhas escalas" RECOLHIDA por padrao, o cabecalho e a unica
    // coisa que a pessoa ve. Escala sem data legivel virando "nao pende" some
    // do aviso e a coordenacao fica sem resposta.
    nome: "escalas: escala sem data deixar de contar como pendente",
    arq: "lib/resumoEscalas.ts",
    de: "  if (!e.data) return true;",
    para: "  if (!e.data) return false;",
  },
  {
    // ⚠️ Mensagem SEM LINK é lixo no WhatsApp de quem recebeu — e quem recebeu
    // não é da igreja, então ninguém do lado de dentro descobre. A régua tem
    // que devolver null pra a tela ESCONDER o botão.
    nome: "compartilhar: montar convite mesmo sem link",
    arq: "lib/compartilharInscricao.ts",
    de: "  if (!url || !nome) return null;",
    para: "  if (!nome) return null;",
  },
  {
    // Porta nova vinda do servidor não pode desaparecer da tela só porque a
    // copy dela ainda não existe neste bundle.
    nome: "compartilhar: porta sem copy propria deixa de ter convite",
    arq: "lib/compartilharInscricao.ts",
    de: "  const texto = copy ? t(copy) : `${t('Se inscreve aqui')} \u2014 ${porta.nome}`;",
    para: "  if (!copy) return null;\n  const texto = t(copy);",
  },
  {
    // ⚠️ Sem o ramo `home`, o menu volta a ser beco sem saída: a Home NÃO está
    // na barra, então de dentro do menu não há caminho de 1 toque de volta.
    nome: "barra: tocar em Menu no menu deixa de voltar pra Home",
    arq: "lib/nav.ts",
    de: '  return VOLTA_PRA_HOME.has(d) ? "home" : "nada";',
    para: '  return "nada";',
  },
  {
    // ⚠️ O conserto de 26/08 (espaço inquebrável) NÃO funcionava, e o Matheus
    // voltou dizendo isso. Este mutante é o "não faz nada" original: devolver o
    // texto intacto é exatamente o efeito que o NBSP tinha.
    nome: "atalho: rótulo deixa de quebrar (o no-op do NBSP)",
    arq: "lib/rotuloAtalho.ts",
    de: "  if (i <= 0 || i === limpo.length - 1) return limpo;",
    para: "  return limpo;",
  },
  {
    // Sem normalizar o NBSP herdado da chave antiga, o rótulo é UMA palavra e a
    // função sai pelo `i <= 0` — o bug de volta, em silêncio.
    nome: "atalho: NBSP deixa de contar como separador",
    arq: "lib/rotuloAtalho.ts",
    de: '  const i = limpo.indexOf(" ");',
    para: '  const i = t.indexOf(" ");',
  },
  {
    // ⚠️ O oposto: TODA aba acesa jogando pra Home faz a pessoa perder a tela
    // num toque acidental.
    nome: "barra: qualquer aba acesa passa a voltar pra Home",
    arq: "lib/nav.ts",
    de: 'const VOLTA_PRA_HOME = new Set<string>(["/menu"]);',
    para: 'const VOLTA_PRA_HOME = new Set<string>(ROTAS_BARRA);',
  },
  {
    // ⚠️⚠️ O BUG DO "INSTALOU E VEIO A VERSÃO ANTIGA" (29/08). Sem a exceção do
    // lançamento embutido, a guarda `baixouNestaSessao` — que existe pra não
    // interromper quem ESTÁ usando — bloqueia também a primeira abertura, onde
    // não há nada a interromper. É isso que cobrava o ciclo de duas aberturas.
    nome: "portaoUpdate: sem a exceção da primeira abertura (o bug original)",
    arq: "lib/portaoUpdate.ts",
    de: '  if (e.lancamentoEmbutido) return { aplicar: true, motivo: "primeira_abertura" };',
    para: "",
  },
  {
    // Ficha aberta segura o portão MESMO na primeira abertura: dá pra instalar,
    // abrir e começar o /completar-cadastro antes de o download terminar.
    nome: "portaoUpdate: primeira abertura passando por cima da ficha aberta",
    arq: "lib/portaoUpdate.ts",
    de: '  if (e.fichaAberta) return { aplicar: false, motivo: "ficha_aberta" };',
    para: "",
  },
  {
    // ⚠️ AMI e Bridge não têm Kids. `has_kids` nulo tratado como "tem" acende o
    // card e manda o pai gerar um código que nenhum totem vai ler naquele dia.
    nome: "kidsHoje: has_kids nulo contando como culto com Kids",
    arq: "lib/kidsHoje.ts",
    de: "c?.data === hojeISO && c?.has_kids === true",
    para: "c?.data === hojeISO && c?.has_kids !== false",
  },
  {
    // A lista da Home traz 7 dias. Sem o corte por data o card fica aceso a
    // semana inteira, e o código de 12h gerado na quarta morre antes do domingo.
    nome: "kidsHoje: card aceso a semana toda (ignora o dia de hoje)",
    arq: "lib/kidsHoje.ts",
    de: "c?.data === hojeISO && c?.has_kids === true",
    para: "c?.has_kids === true",
  },
  {
    // ⚠️⚠️ Sem alvo, sem botão. As notificações de escala anteriores a 29/08 têm
    // `data = {tipo:'escala'}`: oferecer botão nelas manda o app responder por
    // uma escala que ninguém identificou — ou tomar 400 na cara da pessoa.
    nome: "acoesNotificacao: escala sem ids ganhando botão",
    arq: "lib/acoesNotificacao.ts",
    de: "    if (!escalaIds.length) return { acoes: [], feita: null };",
    para: "",
  },
  {
    // Já respondida vira desfecho. Sem isso a pessoa toca de novo, o servidor
    // diz "já estava assim" e ela conclui que o app não gravou.
    nome: "acoesNotificacao: já respondida voltando a mostrar botão",
    arq: "lib/acoesNotificacao.ts",
    de: '  if (d.acao) return { acoes: [], feita: String(d.acao) };',
    para: "",
  },
  // ⚠️ NÃO entra aqui um mutante pro `crianca_nome` da tela de apresentação
  // (o campo que estava lido como `bebe_nome` e mostrava `undefined` em
  // produção): o escopo deste harness é código PURO de `lib/`, e o vitest não
  // monta tela. O mutante foi escrito, RODADO e sobreviveu — por escopo, não
  // por régua fraca. A classe de bug real é "o app lê um campo que o backend
  // não manda", e ela só se pega cruzando os dois repos, que é coisa que nem o
  // `tsc` faz (o tipo é declarado na própria tela, e a resposta da API não é
  // validada em runtime). Fica registrado pra ninguém achar que está coberto.
  {
    // ⚠️ O mutante do CRASH. Mudança nativa não viaja por OTA, e com
    // `runtimeVersion.policy = appVersion` travado em 1.0.0 o manifesto entrega
    // mesmo assim: o pacote novo chega a um binário sem aquele código nativo.
    // Medido em 03/09: o `googleServicesFile` entrou em 18/08 (#124) e a Play
    // servia a vc 5 de 24/07 — daí o "Default FirebaseApp is not initialized".
    nome: "driftLoja: mudança nativa deixar de bloquear (o caminho do crash)",
    arq: "scripts/driftLoja.js",
    de: "  if (nativo === true || estourouTeto) return { nivel: 'bloqueio', motivos };",
    para: "  if (estourouTeto) return { nivel: 'bloqueio', motivos };",
  },
  {
    // ⚠️ Fail-open virando fail-closed: um ledger ilegível passaria a TRAVAR
    // toda publicação de OTA — inclusive um hotfix de domingo. É o oposto da
    // lei de `lib/versaoApp.ts`, e o defeito seria descoberto no pior momento.
    nome: "driftLoja: desconhecido virar bloqueio (fail-closed)",
    arq: "scripts/driftLoja.js",
    de: "    return { nivel: nativo === true ? 'bloqueio' : 'desconhecido', motivos };",
    para: "    return { nivel: 'bloqueio', motivos };",
  },
  {
    // ⚠️ "Não consegui medir" tratado como "medi e está errado": bastaria o
    // commit-base sair do clone pra travar o OTA sem fato nenhum na mão.
    nome: "driftLoja: mudouNativo ausente virar true",
    arq: "scripts/driftLoja.js",
    de: "  const nativo = e && typeof e.mudouNativo === 'boolean' ? e.mudouNativo : null;",
    para: "  const nativo = e && typeof e.mudouNativo === 'boolean' ? e.mudouNativo : true;",
  },
  {
    // ⚠️ Off-by-one na cadência combinada: com `>` o aviso só sai no 15º dia, e
    // a régua deixa de ser "a cada 2 semanas" caladinha.
    nome: "driftLoja: cadência de aviso virar > em vez de >=",
    arq: "scripts/driftLoja.js",
    de: "    (dias !== null && dias >= limites.avisoDias) ||",
    para: "    (dias !== null && dias > limites.avisoDias) ||",
  },
  {
    // ⚠⚠ Voltar a procurar só a chave ENTRE ASPAS faz o scanner contar como
    // dívida 10 chaves que JÁ estão traduzidas — e quem tentar "pagar" leva
    // TS1117 (chave repetida) sem saída.
    nome: "i18n: noDicionario deixar de ver a chave sem aspas",
    arq: "scripts/i18n-cobertura.mjs",
    de: '  if (/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(chave)) {',
    para: '  if (false) {',
  },
  {
    // ⚠⚠ MEDIDO no dicionário real: sem a âncora de início de propriedade, `HH`
    // casa dentro de "Horário (HH:MM)" e `e` dentro de "an estimate:" — as duas
    // sairiam da contagem EM SILÊNCIO sem ter entrada nenhuma.
    nome: "i18n: noDicionario sem âncora de início de propriedade",
    arq: "scripts/i18n-cobertura.mjs",
    de: '${INICIO_DE_PROPRIEDADE}${escapado}',
    para: '${escapado}',
  },
  {
    // ⚠⚠ O scanner casa TEXTO: comentario que mencione `CPF:` marcaria a chave
    // como traduzida sem existir entrada. É a armadilha do `//` na fonte da verdade.
    nome: "i18n: dicionario lido COM comentario",
    arq: "scripts/i18n-cobertura.mjs",
    de: 'export const DICIONARIO = semComentarios(',
    para: 'export const DICIONARIO = ((x) => x)(',
  },
  {
    // ⚠⚠ `new Date("YYYY-MM-DD")` e meia-noite UTC = 21h do dia anterior no Rio:
    // a tela de gestao abriria na turma do domingo PASSADO no meio do domingo.
    nome: "nextGestao: turma sugerida comparada por Date em vez de string",
    arq: "lib/nextGestao.ts",
    de: "  const hojeMesmo = com.find((x) => x.data === hoje);",
    para: "  const hojeMesmo = com.find((x) => new Date(x.data).getDate() === new Date(hoje).getDate() - 1);",
  },
  {
    // ⚠⚠ Sem olhar o `presente`, o contador do heroi soma quem foi DESMARCADO —
    // o card diria mais gente na sala do que a chamada mostra.
    nome: "nextGestao: contar presente ignorando o campo `presente`",
    arq: "lib/nextGestao.ts",
    de: "    if (!p || p.presente !== true) continue;",
    para: "    if (!p) continue;",
  },
  {
    // ⚠ A mesma pessoa em 2 encontros contaria 2 sem o Set por matricula.
    nome: "nextGestao: contar presenca por LINHA em vez de por pessoa",
    arq: "lib/nextGestao.ts",
    de: "  return vistos.size;",
    para: "  return (Array.isArray(presencas) ? presencas : []).filter((p) => p && p.presente === true && (!encontroId || p.encontro_id === encontroId)).length;",
  },
  {
    // ⚠⚠ O batismo exige HORÁRIO, e quem lança 400 é o servidor
    // (`services/nextDirecionar.js`). Sem esta guarda o líder preenche o
    // direcionamento inteiro no fim do encontro, toca em "Direcionar" e leva
    // erro — com a fila esperando.
    nome: "nextGestao: batismo sem horário passar",
    arq: "lib/nextGestao.ts",
    de: '    if (!String(entrada.horarioBatismo || "").trim()) {',
    para: '    if (false) {',
  },
  {
    // ⚠️⚠️ A máscara de data serve DUAS portas de PESSOA (o /completar-cadastro
    // e o "Adicionar pessoa" do grupo). Sem o teto de 8 dígitos o ano aceita
    // 5+ e a pessoa entra na base com nascimento absurdo — e em data de
    // NASCIMENTO um dígito a mais erra por um século.
    nome: "mascaraDataBR: ano sem teto de 4 dígitos",
    arq: "lib/validators.ts",
    de: "  const d = onlyDigits(v).slice(0, 8);",
    para: "  const d = onlyDigits(v);",
  },
  {
    // ⚠⚠ `new Date("YYYY-MM-DD")` é meia-noite UTC = 21h do dia anterior no
    // Rio: o encontro de HOJE deixaria de casar e o walk-in do domingo cairia
    // no encontro errado. É a armadilha registrada 4× neste repo.
    nome: "nextGestao: comparar encontro por Date em vez de string",
    arq: "lib/nextGestao.ts",
    de: "  const doDia = comData.find((e) => e.data === hoje);",
    para: "  const doDia = comData.find((e) => new Date(e.data as string).getDate() === new Date(hoje).getDate() - 1);",
  },
  {
    // ⚠ Oferecer turma encerrada no seletor manda o líder pro 403 do servidor.
    nome: "nextGestao: oferecer turma encerrada pra receber gente",
    arq: "lib/nextGestao.ts",
    de: '  return (Array.isArray(turmas) ? turmas : []).filter((t) => t && t.status === "aberta");',
    para: "  return Array.isArray(turmas) ? turmas : [];",
  },
  {
    // ⚠ "Não deu pra saber" virando "pode direcionar" faria a tela oferecer
    // um horário que o servidor recusa — o oposto de declarar a lacuna.
    nome: "nextGestao: catálogo indisponível deixar de bloquear",
    arq: "lib/nextGestao.ts",
    de: "    if (entrada.batismoIndisponivel) {",
    para: "    if (false) {",
  },
  {
    // ⚠️⚠️ A folha de recusa de PEDIDO sumiu do arquivo no refactor f246407
    // (05/08/2026) e ficou 7 semanas sem ninguém notar: o botão "Recusar" do
    // card de pendentes gravava `recusaAlvo` e NADA abria ("não consigo
    // apertar" — Marcos, Android, 23/09). Este mutante é a AUSÊNCIA da folha,
    // byte a byte o que estava em produção — não um operador trocado.
    nome: "grupo-membros: botão Recusar sem folha (estado gravado e nunca lido)",
    arq: "app/(app)/grupo-membros.tsx",
    de: `      <Modal visible={!!recusaAlvo} animationType="slide" transparent statusBarTranslucent onRequestClose={() => setRecusaAlvo(null)}>
        <TecladoSeguro style={styles.modalWrap}>
          <View style={[styles.sheet, { paddingBottom: fundoSeguro }]}>
            <View style={styles.sheetHead}>
              <Text style={styles.sheetTitle}>{t("Recusar inscrição")}</Text>
              <Pressable onPress={() => setRecusaAlvo(null)} hitSlop={12} accessibilityRole="button" accessibilityLabel={t("Fechar")}>
                <Ionicons name="close" size={24} color={colors.text} />
              </Pressable>
            </View>
            {recusaAlvo && <Text style={[styles.muted, { marginBottom: spacing.xs }]}>{t("Recusar a inscrição de")} {recusaAlvo.nome}?</Text>}
            <Text style={[styles.muted, { marginBottom: spacing.sm }]}>
              {t("O pedido volta pra equipe de grupos, que cuida do próximo passo com a pessoa. Ela não recebe aviso automático.")}
            </Text>
            <Text style={styles.sheetLabel}>{t("Motivo (opcional)")}</Text>
            <TextInput
              style={styles.input}
              placeholder={t("Ex.: grupo lotado, pessoa já em outro grupo…")}
              placeholderTextColor={colors.textMuted}
              value={motivo}
              onChangeText={setMotivo}
              multiline
            />
            <Pressable style={[styles.btn, styles.btnRecusarSolido, { marginTop: spacing.md }]} disabled={!!processandoId} onPress={confirmarRecusa} accessibilityRole="button">
              {processandoId ? <ActivityIndicator color="#fff" size="small" /> : <Text style={[styles.btnTxt, { color: "#fff" }]}>{t("Confirmar recusa")}</Text>}
            </Pressable>
          </View>
        </TecladoSeguro>
      </Modal>
`,
    para: "",
  },
  // ═══ MONTAR ESCALA POR TIME (23/09/2026) · a régua do carrossel ═══
  {
    // ⚠️⚠️ O bug de 21/08 do servidor, agora na régua do app: quem RECUSOU
    // contando como vaga preenchida. O supervisor veria "Vocal 2/2" com uma
    // pessoa que acabou de dizer que não vai — e não reporia.
    nome: "escalaTimes: quem recusou preenche a vaga",
    arq: "lib/escalaTimes.ts",
    de: '  return status !== "declined";',
    para: "  return true;",
  },
  {
    // ⚠️⚠️ O que estava em produção até 23/09: agrupar pela string `team_name`.
    // Nas linhas do Planning Center ela é a POSIÇÃO ("Vocal", "Chat 9:30") —
    // 21 "equipes" de uma pessoa no Domingo - Manhã de 27/09. Sem esta linha o
    // `team_id` deixa de resolver o time e cada nome vira um time.
    nome: "escalaTimes: ignorar o team_id (cada posição do PCO vira um time)",
    arq: "lib/escalaTimes.ts",
    de: "  if (linha.team_id && porId.has(linha.team_id)) return linha.team_id;\n",
    para: "",
  },
  {
    // O PATCH do app grava só `team_name`. Se o nome deixar de vencer o
    // `team_id` velho, quem foi movido pelo app aparece no time de ONDE saiu.
    nome: "escalaTimes: team_id velho vence o nome recém-gravado (movido volta pro time antigo)",
    arq: "lib/escalaTimes.ts",
    de: "  const pelaNome = n ? porNome.get(n) : undefined;",
    para: "  const pelaNome = undefined;",
  },
  {
    // A 5ª semana do mês tem que virar 1ª como no servidor (`semanaDoRodizio`).
    // Sem isso a tela diz "quem prefere o 5º domingo vem primeiro" — um domingo
    // que ninguém pode escolher — enquanto a lista veio ordenada pelo 1º.
    nome: "escalaTimes: a 5ª semana não vira 1ª (tela e servidor discordam)",
    arq: "lib/escalaTimes.ts",
    de: "  return ord > 4 ? 1 : ord;",
    para: "  return ord;",
  },
  {
    // Sem a separação, a tela volta a mostrar o time inteiro misturado — e o
    // líder procurando um saxofonista rola 117 nomes da Banda.
    nome: "escalaTimes: a vaga deixa de separar quem tem a função",
    arq: "lib/escalaTimes.ts",
    de: "    (tem ? daVaga : resto).push(p);",
    para: "    resto.push(p);",
  },
  {
    // Filtrar com acento faria "edu" não achar "Édu" — a pessoa está no time,
    // o líder digita o nome e a lista fica vazia.
    nome: "escalaTimes: filtro do time sensível a acento",
    arq: "lib/escalaTimes.ts",
    de: '  return s.normalize("NFD").replace(/[\\u0300-\\u036f]/g, "").toLowerCase().trim();',
    para: "  return s.toLowerCase().trim();",
  },
  {
    // Soltar o nome no PRÓPRIO time chamaria o servidor, que gravaria
    // `team_name = "Banda"` numa linha do PCO cujo `team_name` era a posição —
    // apagando a posição de origem em silêncio, a cada toque longo.
    nome: "escalaTimes: soltar no próprio time chama o servidor",
    arq: "lib/escalaTimes.ts",
    de: "  if (chaveDoTime(linha, porNome, porId) === chaveAlvo) return null;\n",
    para: "",
  },
  {
    // A etapa 1 abre no tipo do culto MAIS PRÓXIMO. Em ordem alfabética o
    // supervisor da quarta à noite abriria a tela em "CBKIDS - Manhã Domingo".
    nome: "escalaTimes: tipos em ordem alfabética em vez da ordem do próximo culto",
    arq: "lib/escalaTimes.ts",
    de: "  return [...porTipo.entries()].map(([tipo, lista]) => ({ tipo, cultos: lista }));",
    para: "  return [...porTipo.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([tipo, lista]) => ({ tipo, cultos: lista }));",
  },
  {
    // ⚠️ 25/08 + 23/09: dois relatos do Marcos no MESMO botão ("fica onde estão
    // os botões do Android" · "poderia ter clicado em fechar sem querer"). A
    // regressão é somar o inset cru — que dentro de um Modal do Android pode
    // ser 0 — e o botão encosta na barra de navegação.
    nome: "folha: tirar o piso do fundo (inset cru encosta o botão na barra do Android)",
    arq: "lib/folha.ts",
    de: "  return Math.max(inset, BARRA_NAV_ANDROID) + RESPIRO_DA_FOLHA;",
    para: "  return inset + RESPIRO_DA_FOLHA;",
  },
  {
    // ⚠️ 23/09: "quando a pessoa está dizendo quem é, quando o teclado sobe
    // fica difícil de ver". A regressão é o <Input> parar de avisar o
    // formulário no foco — TecladoSeguro continua, mas ninguém rola até o campo.
    nome: "input: perder o gancho de foco (o formulário não rola até o campo)",
    arq: "components/ui/Input.tsx",
    de: "          onFocus={(e) => { rolar?.(raiz.current); rest.onFocus?.(e); }}",
    para: "",
  },
  {
    // ⚠️ 23/09: "abria uma janela quadrada e feia". A regressão é alguém
    // devolver o Aprovar pro Alert.alert com botões — a lista de confirmações
    // nativas por título é o que pega.
    nome: "grupo-membros: Aprovar voltar pra Alert.alert (janela quadrada)",
    arq: "app/(app)/grupo-membros.tsx",
    de: "    const ok = await dlg.confirmar({\n      titulo: t(\"Aceitar inscrição\"),\n      mensagem: `${t(\"Aprovar\")} ${p.nome}?`,",
    para: "    Alert.alert(t(\"Aceitar inscrição\"), `${t(\"Aprovar\")} ${p.nome}?`, [{ text: t(\"Cancelar\"), style: \"cancel\" }]);\n    const ok = await dlg.confirmar({\n      titulo: t(\"Aceitar inscrição\"),\n      mensagem: `${t(\"Aprovar\")} ${p.nome}?`,",
  },
  {
    // Plano por INSCRIÇÃO (24/09/2026): sem esta guarda TODO dia não lido vira
    // "atual" e a pessoa abre o dia 5 antes do 1 — a régua "um dia por vez" some
    // sem erro nenhum (a tela só desenha o que a régua devolve).
    nome: "planoRitmo: liberar todos os dias não lidos de uma vez",
    arq: "lib/planoRitmo.ts",
    de: "    if (!atualDefinido) { atualDefinido = true; return { item, numero: i + 1, estado: \"atual\" as const }; }",
    para: "    if (true) { return { item, numero: i + 1, estado: \"atual\" as const }; }",
  },
  {
    // A ordem vem de ordem_no_ciclo, nunca da ordem em que o banco devolve —
    // com a data sentinela (2000-01-0N) o `order(\"data\", desc)` do lib traria o dia 5 primeiro.
    nome: "planoRitmo: não ordenar por ordem_no_ciclo",
    arq: "lib/planoRitmo.ts",
    de: "  return [...itens].sort((a, b) => {",
    para: "  return [...itens].filter(() => true); const _x = (a: ItemOrdenavel, b: ItemOrdenavel) => {",
  },
  {
    // O índice único de mem_devocionais é PARCIAL desde 09/09; ON CONFLICT não o
    // infere (42P10). Voltar ao upsert é reabrir 15 dias de check-in perdido.
    nome: "devocional: voltar ao upsert em mem_devocionais (42P10 no check-in)",
    arq: "lib/devocional.ts",
    de: "    : await supabase.from(\"mem_devocionais\").insert({ membro_id: membroId, data_devocional: hoje, tipo: \"pessoal\", ...linha });",
    para: "    : await supabase.from(\"mem_devocionais\").upsert({ membro_id: membroId, data_devocional: hoje, tipo: \"pessoal\", ...linha }, { onConflict: \"membro_id,data_devocional,tipo\" });",
  },
  {
    // Sem o clamp, PASSOS_FONTE[n] vira undefined ⇒ fontSize NaN ⇒ o texto some.
    nome: "fonteLeitura: A+ sem travar na ponta (fontSize NaN)",
    arq: "lib/fonteLeitura.ts",
    de: "  return Math.min(PASSOS_FONTE.length - 1, Math.max(0, base + direcao));",
    para: "  return base + direcao;",
  },
  {
    // "Pr. Pedrão" viraria fim de frase e o parágrafo quebraria no meio do nome.
    nome: "paragrafos: tratar abreviação (Pr.) como fim de frase",
    arq: "lib/paragrafos.ts",
    de: "    if (anterior && ABREVIACAO_FINAL.test(anterior)) saida[saida.length - 1] = `${anterior} ${p}`;",
    para: "    if (false) saida[saida.length - 1] = `${anterior} ${p}`;",
  },
  {
    nome: "hierarquia: o pai deixa de herdar o planoId (voltar da leitura abre 'Plano não encontrado')",
    arq: "lib/hierarquia.ts",
    de: '  "/devocional-plano-dia": ["planoId"],',
    para: '  "/devocional-plano-dia": [],',
  },
  {
    nome: "planoRitmo: a tela sempre abre na semana 1 (não avança ao fechar uma semana)",
    arq: "lib/planoRitmo.ts",
    de: '  return (semanas.find((s) => !s.completa) ?? semanas[semanas.length - 1]).numero;',
    para: '  return semanas[0].numero;',
  },
  {
    nome: "videoDevocional: qualquer erro vira 'falta a coluna' (esconde 42501 e outros)",
    arq: "lib/videoDevocional.ts",
    de: '  return !!e && e.code === "42703" && typeof e.message === "string" && e.message.includes(coluna);',
    para: '  return !!e;',
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
