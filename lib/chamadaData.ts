// ============================================================================
// QUAL DIA A CHAMADA ESTÁ REGISTRANDO (21/09/2026 · pedido dos líderes)
//
// Trazido pelo Marcos depois da reunião de lançamento: *"quando você coloca
// preencher frequência, ali em cima ele coloca 'frequência de hoje'; deve
// mostrar o dia do grupo que a frequência está sendo registrada. E aí, não deve
// criar o dia de hoje como a presença, deve atrelar ao dia do grupo correto."*
//
// ⚠️⚠️ ERAM DOIS DEFEITOS, e o segundo é o grave:
//
//  1. O título da folha era a string fixa "Frequência de hoje". O líder que
//     registrava o encontro atrasado do dia 15 lia "hoje" e ficava em dúvida se
//     tinha gravado no dia certo — dúvida que o Marcos já tinha relatado em
//     agosto e que o `chamadaData` consertou no POST, mas não no texto.
//
//  2. O herói oferece "Registrar presença" TAMBÉM quando o próximo encontro
//     ainda não aconteceu ("Próximo encontro · em 3 dias"). Ali ele abria a
//     chamada com a data FUTURA e o servidor recusava com 400 ("Não dá pra
//     registrar encontro no futuro"), que chegava na tela como o alerta seco
//     "Não deu". Medido no código em 20/09: não havia guarda nenhuma no app.
//
// ⇒ A régua: a chamada NUNCA nasce numa data futura. Se a ocorrência apontada
//   ainda não chegou, ela cai na ocorrência ANTERIOR do grupo (a que de fato
//   aconteceu). Sem anterior conhecida, devolve `null` — e `null` significa
//   "deixa o servidor decidir", que é o default BRT dele. O app não calcula
//   fuso: essa lei é de 10/08 e continua valendo.
// ============================================================================

const ISO = /^\d{4}-\d{2}-\d{2}$/;

const valida = (d?: string | null): string | null =>
  d && ISO.test(String(d)) ? String(d) : null;

/**
 * A data que a chamada deve gravar.
 *
 * @param alvo      ocorrência que a tela quer registrar (pode ser futura)
 * @param hoje      `YYYY-MM-DD` em BRT (`hojeBRT()`), injetado — teste não pode
 *                  depender do relógio, e o app não recalcula fuso
 * @param anterior  ocorrência anterior do grupo, vinda da AGENDA DO SERVIDOR
 *                  (`anterior` de `/grupos/:id/agenda`). `null` = não há (foi
 *                  cancelada) ou não sabemos.
 * @returns ISO a gravar, ou `null` para o servidor usar o dia de hoje.
 */
export function dataDaChamada(args: {
  alvo?: string | null;
  hoje: string;
  anterior?: string | null;
}): string | null {
  const alvo = valida(args.alvo);
  const hoje = valida(args.hoje);
  if (!hoje) return alvo; // sem régua de hoje, não inventa nada
  if (alvo && alvo <= hoje) return alvo;
  // Alvo futuro (ou ausente): tenta a ocorrência que já aconteceu.
  const anterior = valida(args.anterior);
  if (anterior && anterior <= hoje) return anterior;
  return null;
}

/**
 * O que o título da folha deve dizer.
 *
 * `null` (ou a própria data de hoje) continua sendo "hoje" — é o caso comum, o
 * líder registrando no fim do encontro, e trocar por uma data ali seria ruído.
 * Qualquer outro dia aparece por extenso, que é o pedido.
 */
export function chamadaEhHoje(data: string | null | undefined, hoje: string): boolean {
  const d = valida(data);
  return !d || d === valida(hoje);
}
