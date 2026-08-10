// ============================================================================
// FICHA ABERTA · o portão de atualização espera (10/08/2026)
//
// Irmã de `lib/cadastroEmAndamento.ts`, e pelo mesmo motivo de fundo: existe uma
// tela que NÃO pode ser desmontada no meio, e quem decide desmontar não sabe que
// ela está aberta.
//
// O caso concreto é o `/completar-cadastro` no caminho rápido: a pessoa digita o
// CPF, o servidor manda um código **por e-mail**, e ela SAI DO APP pra ler o
// e-mail. Ao voltar, o `PortaoAtualizacao` reabre a decisão ("voltou do
// background ⇒ cobra a atualização") — o app reinicia no bundle novo e o
// formulário volta ao primeiro passo, com o código na mão e nada pra preencher.
// Ela tenta de novo, sai pro e-mail de novo, e voltar é o que a derruba de novo.
//
// ⚠️ Isto NÃO afrouxa "se não atualizar não usa": a atualização é cobrada assim
// que a ficha fecha (ou é abandonada), e o teto abaixo garante que ela é cobrada
// mesmo se a tela morrer de um jeito que não avise.
// ============================================================================

/**
 * ⚠️ FAIL-SAFE: se a tela travar ou o app for fechado à força com a bandeira
 * ligada, o portão nunca mais cobraria — e código velho conversando com backend
 * novo é o que o portão existe pra impedir. 10 minutos é folga larga pra ler um
 * e-mail e voltar, e curta o bastante pra não virar bypass.
 */
const TETO_MS = 10 * 60 * 1000;

let aberto = false;
let timer: ReturnType<typeof setTimeout> | null = null;
const ouvintes = new Set<() => void>();

function avisar() {
  // Cópia: um ouvinte pode se desinscrever durante a notificação.
  for (const fn of Array.from(ouvintes)) fn();
}

export function abrirFichaCadastro() {
  if (timer) clearTimeout(timer);
  aberto = true;
  timer = setTimeout(() => {
    aberto = false;
    timer = null;
    avisar();
  }, TETO_MS);
  avisar();
}

export function fecharFichaCadastro() {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  aberto = false;
  avisar();
}

export function lerFichaCadastro(): boolean {
  return aberto;
}

export function assinarFichaCadastro(fn: () => void): () => void {
  ouvintes.add(fn);
  return () => {
    ouvintes.delete(fn);
  };
}
