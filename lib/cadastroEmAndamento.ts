// ============================================================================
// CADASTRO NATIVO EM ANDAMENTO — a corrida que rebatia quem acabou de se
// cadastrar (07/08/2026)
//
// Relato do Marcos, no 2º teste: *"novamente ao entrar ele pediu para validar a
// conta, ele já tem todos os dados e não precisa confirmar quem é"*. Mas desta
// vez o conserto de ontem FUNCIONOU — medido na conta "João Marcos Da Silva
// Santos": `app_ficha_confirmada_em` gravado às **15:20:15.606**, com
// `matched_by: cpf`. O que sobrou é uma CORRIDA, não a falta do carimbo:
//
//   15:20:13.9  signup → sessão criada
//   15:20:14.5  `completarCadastroApp` roda (observação de identidade gravada)
//   15:20:15.6  carimbo gravado
//   15:20:19    telemetria: tela `/` → tela `/completar-cadastro`
//
// Assim que a sessão existe, o `RootNavigator` troca pra área logada e o
// `CadastroGate` monta e pergunta `/identidade/status` **na mesma hora** — em
// paralelo com o `completarCadastroApp` que ainda está no ar. A resposta volta
// com `completo: false` (o carimbo ainda não existia quando o servidor leu) e o
// portão rebate, 4 segundos depois de a ficha já estar confirmada.
//
// ⚠️ Adiantar a consulta ou "esperar 2 segundos" não resolve: o tempo do
// serverless varia. O que resolve é o portão **não decidir enquanto o cadastro
// está sendo concluído** — que é o que esta bandeira diz.
//
// ⚠️ Isto NÃO afrouxa o portão: quem não completar (falha de rede, campo
// recusado) cai na decisão normal assim que a bandeira baixa, e o servidor
// continua sendo quem diz se a ficha fechou.
// ============================================================================

/**
 * ⚠️ FAIL-CLOSED: se a tela morrer no meio (crash, app fechado à força), a
 * bandeira ficaria ligada e o portão **nunca** decidiria — alguém entraria sem
 * ficha. O teto devolve a decisão pro portão sozinho.
 */
const TETO_MS = 30_000;

let ativo = false;
let timer: ReturnType<typeof setTimeout> | null = null;
const ouvintes = new Set<() => void>();

function avisar() {
  // Cópia: um ouvinte pode se desinscrever durante a notificação.
  for (const fn of Array.from(ouvintes)) fn();
}

export function iniciarCadastroNativo() {
  if (timer) clearTimeout(timer);
  ativo = true;
  timer = setTimeout(() => {
    ativo = false;
    timer = null;
    avisar();
  }, TETO_MS);
  avisar();
}

export function terminarCadastroNativo() {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  ativo = false;
  avisar();
}

export function lerCadastroNativo(): boolean {
  return ativo;
}

export function assinarCadastroNativo(fn: () => void): () => void {
  ouvintes.add(fn);
  return () => {
    ouvintes.delete(fn);
  };
}
