// RECUSA DO CADASTRO QUE VIAJA ATÉ A TELA SEGUINTE (26/11/2026).
//
// Quem cria a conta por e-mail tem a ficha enviada logo depois do signUp. Quando
// o servidor recusava (nome abreviado, nascimento diferente do cadastro da
// igreja), o `catch` só fazia `console.warn`: a pessoa caía em
// `/completar-cadastro`, na tela de CPF, sem saber o que tinha acontecido.
// Medido no lançamento: 7 de 84 contas.
//
// Mostrar o erro na tela de cadastro não resolve: ela já está desmontando (a
// sessão nasceu e o guard trocou de área). A recusa fica guardada AQUI, em
// memória, e a tela de completar cadastro a consome ao montar.
//
// ⚠️ Só o que o servidor respondeu (status 4xx com corpo). Falha de rede não é
// recusa: a ficha pode ter sido salva, e o portão é quem decide.
// ⚠️ Sem dado da pessoa: só código, campo e a mensagem do servidor.

export type RecusaCadastro = { codigo: string; campo: string | null; mensagem: string; status: number };

// Depois disso a recusa não diz mais respeito ao que a pessoa está vendo.
const VALIDADE_MS = 2 * 60 * 1000;

let guardada: { recusa: RecusaCadastro; em: number } | null = null;

/** Lê um erro da API e devolve a recusa, ou null quando não foi o servidor que recusou. */
export function recusaDoErro(e: unknown): RecusaCadastro | null {
  const err = (e && typeof e === "object" ? e : {}) as { status?: unknown; corpo?: any; message?: unknown };
  const status = typeof err.status === "number" ? err.status : 0;
  if (status < 400 || status >= 500) return null;
  const corpo = err.corpo && typeof err.corpo === "object" ? err.corpo : null;
  const mensagem = typeof corpo?.error === "string" ? corpo.error.trim() : "";
  if (!mensagem) return null;
  return {
    codigo: typeof corpo.codigo === "string" && corpo.codigo ? corpo.codigo : "sem_codigo",
    campo: typeof corpo.campo === "string" && corpo.campo ? corpo.campo : null,
    mensagem,
    status,
  };
}

export function guardarRecusaCadastro(recusa: RecusaCadastro, agora: number = Date.now()) {
  guardada = { recusa, em: agora };
}

/** Devolve a recusa guardada UMA vez (e a apaga). Vencida, devolve null. */
export function consumirRecusaCadastro(agora: number = Date.now()): RecusaCadastro | null {
  const atual = guardada;
  guardada = null;
  if (!atual || agora - atual.em > VALIDADE_MS) return null;
  return atual.recusa;
}

/** Sair da conta apaga a recusa: ela é de quem estava logado. */
export function limparRecusaCadastro() {
  guardada = null;
}
