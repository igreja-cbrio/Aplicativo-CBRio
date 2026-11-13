/** Cada troca de pessoa/conversa invalida respostas ainda em trânsito. */
export function criarCicloChat() {
  let revisao = 0;
  let consulta: symbol | null = null;
  return {
    atual: () => revisao,
    vigente: (r: number) => r === revisao,
    reiniciar() { consulta = null; return ++revisao; },
    iniciarConsulta() {
      if (consulta) return null;
      consulta = Symbol('consulta');
      return consulta;
    },
    terminarConsulta(token: symbol) { if (consulta === token) consulta = null; },
  };
}

// Uma gravação antiga nunca termina depois da remoção/restauração seguinte.
// Compartilhada entre montagens da tela; cada operação captura a chave do usuário.
let persistencia = Promise.resolve();
export function persistirChat<T>(operacao: () => Promise<T>): Promise<T> {
  const resultado = persistencia.then(operacao);
  persistencia = resultado.then(() => {}, () => {});
  return resultado;
}
