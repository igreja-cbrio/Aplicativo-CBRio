// FILA DE DOWNLOAD DAS FOTOS (álbum do batismo · 24/11/2026).
//
// Régua PURA (sem React, sem módulo nativo): quem baixa e salva é passado como
// `tarefa`. Existe para que "baixar 300 fotos" nunca vire 300 downloads de
// originais de 10 MB ao mesmo tempo, para que cancelar pare de verdade e para que
// o resumo NUNCA diga "salvas" quando alguma falhou.
//
// ⚠️ A concorrência é o teto de downloads simultâneos. Cada download vai direto
// para um arquivo no disco (não para a memória do JS), então o teto protege
// rede e bateria, e a memória fica limitada ao que a `tarefa` carregar.

export type Cancelamento = {
  readonly cancelado: boolean;
  cancelar(): void;
};

export function novoCancelamento(): Cancelamento {
  let cancelado = false;
  return {
    get cancelado() {
      return cancelado;
    },
    cancelar() {
      cancelado = true;
    },
  };
}

export type ProgressoFila = {
  total: number;
  /** Salvas com sucesso. */
  salvas: number;
  /** Terminaram com erro. */
  falhas: number;
  /** Ainda baixando ou salvando agora. */
  emAndamento: number;
};

export type FalhaFila<T> = { item: T; erro: string };

export type ResumoFila<T> = ProgressoFila & {
  canceladas: number;
  falhou: FalhaFila<T>[];
  /** concluido = todas salvas · parcial = alguma falhou ou foi cancelada · nada = nenhuma salva */
  situacao: "concluido" | "parcial" | "nada";
  cancelado: boolean;
};

export const CONCORRENCIA_PADRAO = 2;
export const CONCORRENCIA_MAXIMA = 3;

function mensagemDeErro(e: unknown) {
  if (e instanceof Error && e.message) return e.message;
  if (typeof e === "string" && e) return e;
  return "Falha desconhecida";
}

/**
 * A tarefa lança isto quando parou porque a pessoa CANCELOU (download pausado
 * no meio). Conta como cancelada, nunca como falha: "1 falhou" para uma foto que
 * a própria pessoa interrompeu seria mentira no resumo.
 */
export class FotoCancelada extends Error {
  constructor() {
    super("Cancelada");
    this.name = "FotoCancelada";
  }
}

export function ehCancelada(e: unknown): boolean {
  return e instanceof FotoCancelada || (!!e && typeof e === "object" && (e as { name?: unknown }).name === "FotoCancelada");
}

/**
 * Executa `tarefa` para cada item com no máximo `concorrencia` ao mesmo tempo.
 * Não lança: cada falha vira uma linha do resumo. Depois de cancelar, nenhum
 * item novo começa; os que já começaram terminam (o download nativo é pausado
 * pela própria tarefa quando ela consulta `cancelamento.cancelado`).
 */
export async function executarFila<T>(
  itens: readonly T[],
  tarefa: (item: T, cancelamento: Cancelamento) => Promise<void>,
  opcoes: {
    concorrencia?: number;
    cancelamento?: Cancelamento;
    aoProgredir?: (p: ProgressoFila) => void;
  } = {},
): Promise<ResumoFila<T>> {
  const cancelamento = opcoes.cancelamento ?? novoCancelamento();
  const teto = Math.max(1, Math.min(CONCORRENCIA_MAXIMA, Math.floor(opcoes.concorrencia ?? CONCORRENCIA_PADRAO)));
  const total = itens.length;
  let proximo = 0;
  let salvas = 0;
  let emAndamento = 0;
  const falhou: FalhaFila<T>[] = [];

  const avisar = () => opcoes.aoProgredir?.({ total, salvas, falhas: falhou.length, emAndamento });

  async function trabalhador() {
    while (!cancelamento.cancelado && proximo < total) {
      const item = itens[proximo];
      proximo += 1;
      emAndamento += 1;
      avisar();
      try {
        await tarefa(item, cancelamento);
        salvas += 1;
      } catch (e) {
        // Interrompida pela pessoa: entra em `canceladas` (total − salvas − falhas).
        if (!ehCancelada(e)) falhou.push({ item, erro: mensagemDeErro(e) });
      } finally {
        emAndamento -= 1;
        avisar();
      }
    }
  }

  avisar();
  await Promise.all(Array.from({ length: Math.min(teto, total) }, () => trabalhador()));

  const canceladas = total - salvas - falhou.length;
  const situacao: ResumoFila<T>["situacao"] =
    salvas === total && total > 0 ? "concluido" : salvas > 0 ? "parcial" : "nada";
  return { total, salvas, falhas: falhou.length, emAndamento: 0, canceladas, falhou, situacao, cancelado: cancelamento.cancelado };
}

/**
 * O texto do fim da fila. Nunca diz "salvas" sozinho quando faltou alguma.
 * `traduzir` recebe cada pedaço em português (chaves de `lib/translations.ts`);
 * sem ele, o texto sai em português.
 */
export function mensagemDoResumo(
  r: Pick<ResumoFila<unknown>, "total" | "salvas" | "falhas" | "canceladas" | "cancelado">,
  traduzir: (pt: string) => string = (pt) => pt,
) {
  const plural = (n: number, um: string, varios: string) => `${n} ${traduzir(n === 1 ? um : varios)}`;
  if (r.total === 0) return traduzir("Nenhuma foto escolhida.");
  if (r.salvas === r.total) return r.total === 1 ? traduzir("Foto salva.") : `${plural(r.total, "foto salva", "fotos salvas")}.`;
  const partes = [`${r.salvas} ${traduzir("de")} ${plural(r.total, "foto salva", "fotos salvas")}`];
  if (r.falhas) partes.push(plural(r.falhas, "falhou", "falharam"));
  if (r.canceladas) partes.push(r.cancelado ? `${plural(r.canceladas, "cancelada", "canceladas")}` : `${plural(r.canceladas, "não começou", "não começaram")}`);
  return `${partes.join(" · ")}.`;
}
