// ============================================================================
// VISITA DE SUPERVISÃO · o que o interruptor "estive presente" decide
// (07/08/2026)
//
// Proposta do Marcos: *"a plataforma entende que quando supervisor preenche a
// frequência é porque fez uma visita e conta isso"*. Eu levantei o risco — o
// indicador passaria a medir "digitou" em vez de "foi lá" — e ele aprovou o
// interruptor **"estive presente no encontro", LIGADO por padrão**.
//
// ⚠️⚠️ O INTERRUPTOR SÓ FUNCIONA PORQUE DESLIGADO NÃO GRAVA NADA.
// Medido em 07/08: o KPI real (`_kpi_agregar_dado`, ramo `lideres_acompanhados`)
// conta `DISTINCT lider_id` das visitas do período e **NÃO filtra `status`** —
// 'agendada' e 'cancelada' contam igual a 'realizada'. Ou seja, gravar a linha
// com outro status faria o interruptor virar puro enfeite. Não gravar é o que
// lhe dá efeito real, e sem depender de migration.
//
// ⚠️ Consequência assumida: com o interruptor desligado, o comentário não tem
// onde morar (não existe estado "acompanhei à distância" no CHECK da coluna:
// só agendada|realizada|cancelada). Por isso a TELA esconde o campo — comentário
// "sobre a visita" quando não houve visita não é um dado que a gente saiba
// guardar hoje. Se um dia for preciso, o caminho é a tabela irmã
// `grupo_supervisao_observacoes` (existe, vazia) + decisão do Marcos.
//
// ⚠️ A frequência é gravada nos DOIS casos — ela é do GRUPO e vai pro líder,
// como ele pediu. O interruptor só decide a VISITA.
// ============================================================================

export type ErroVisita = "data_invalida" | "data_futura";

export type PlanoVisita =
  | { erro: ErroVisita }
  /** Não esteve presente: a frequência vai, a visita não. */
  | { gravar: false }
  | { gravar: true; corpo: { data_visita: string; observacao: string | null } };

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/**
 * @param hoje `YYYY-MM-DD` **em BRT** (`hojeBRT()`), injetado — o servidor
 *   recusa data futura pela mesma régua, e teste não pode depender do relógio.
 */
export function montarRegistroVisita(entrada: {
  data: string;
  presente: boolean;
  comentario?: string | null;
  hoje: string;
}): PlanoVisita {
  const { data, presente, hoje } = entrada;
  if (!ISO.test(String(data || ""))) return { erro: "data_invalida" };
  // Espelha a recusa do servidor: registrar visita no futuro não é registro,
  // é agendamento — e agendar é outro fluxo (a aba Visitas do /grupos).
  if (data > hoje) return { erro: "data_futura" };
  if (!presente) return { gravar: false };
  const obs = String(entrada.comentario ?? "").trim().slice(0, 2000);
  return { gravar: true, corpo: { data_visita: data, observacao: obs || null } };
}
