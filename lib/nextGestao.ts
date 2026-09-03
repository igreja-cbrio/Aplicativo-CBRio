// ============================================================================
// GESTÃO DO NEXT NO APP · o que a TELA pode oferecer (03/09/2026)
//
// ⚠️⚠️ QUEM AUTORIZA É O SERVIDOR. `backend/utils/nextGestaoApp.js` decide
// entrar (matriz do módulo `next` >= 2 ∪ posse da turma) e agir (escrita >= 2 ∪
// posse), e responde 403. Esta régua existe pra a tela **não oferecer o que vai
// falhar** — botão que devolve 403 é pior que botão ausente.
//
// ⚠️⚠️ POR QUE A TELA DE GESTÃO EXISTIA E NINGUÉM ALCANÇAVA. Até 03/09 os
// endpoints `/app/next/*` gateavam por POSSE (`next_turmas.responsavel_id`) e as
// 44 turmas vivas têm esse campo NULO — `GET /app/next/papel` respondia
// `responsavel: false` pra TODO MUNDO e a seção "Turmas que você conduz" nunca
// renderizava. Não era tela faltando: era caminho inalcançável.
// ============================================================================

/** Destinos que o app oferece. Espelha o `permitir` do `POST .../direcionar`. */
export type DestinoNext = "batismo" | "voluntarios" | "grupos";

export const DESTINOS_NEXT: { chave: DestinoNext; rotulo: string; icone: string }[] = [
  { chave: "batismo", rotulo: "Batismo", icone: "water-outline" },
  { chave: "voluntarios", rotulo: "Quero servir", icone: "hand-left-outline" },
  { chave: "grupos", rotulo: "Grupo de conexão", icone: "people-outline" },
];

/**
 * ⚠️⚠️ O HORÁRIO DO BATISMO É OBRIGATÓRIO, e quem manda é a régua do servidor
 * (`services/nextDirecionar.js` LANÇA 400 quando falta). Aqui a mesma condição
 * decide o estado do botão: sem isso a pessoa preenche o direcionamento inteiro
 * no fim do encontro, toca em "Direcionar" e leva um erro — com a fila
 * esperando.
 *
 * ⚠️ `motivo` é o que a tela ESCREVE ao lado do botão desabilitado. Botão cinza
 * sem explicação lê-se como app quebrado (a lição do calendário de 25/08).
 */
export function podeDirecionar(entrada: {
  destinos: DestinoNext[];
  horarioBatismo?: string | null;
  batismoIndisponivel?: boolean;
}): { pode: boolean; motivo?: string } {
  const destinos = Array.isArray(entrada?.destinos) ? entrada.destinos : [];
  if (destinos.length === 0) return { pode: false, motivo: "Escolha ao menos um destino." };

  if (destinos.includes("batismo")) {
    // ⚠️ `indisponivel` NÃO é "não tem horário": é "não deu pra saber" (ou a
    // equipe fechou tudo). O servidor o declara de propósito; tratar como
    // ausência faria a tela dizer que o batismo não existe.
    if (entrada.batismoIndisponivel) {
      return { pode: false, motivo: "Os horários do batismo não carregaram. Tente de novo." };
    }
    if (!String(entrada.horarioBatismo || "").trim()) {
      return { pode: false, motivo: "Escolha o horário do batismo." };
    }
  }
  return { pode: true };
}

/**
 * ⚠️ Áreas do "quero servir" NÃO são obrigatórias: a régua do servidor aceita
 * `voluntarios` sem área (a equipe conversa depois). Exigir aqui travaria o
 * direcionamento por um campo que o servidor não pede — o mesmo desalinhamento
 * que fez o batismo pedir dado que a ficha já tinha.
 */
export function areasSaoObrigatorias(): boolean {
  return false;
}

export type TurmaGestaoLeve = {
  id: string;
  nome?: string | null;
  status?: string | null;
  encontros?: { id: string; numero?: number | null; data?: string | null }[] | null;
};

/**
 * Turmas que podem RECEBER alguém da fila.
 *
 * ⚠️ Só `aberta`. O servidor recusa turma encerrada, e oferecer uma no seletor
 * seria empurrar o líder pro 403. Turma encerrada continua acessível pra
 * CORRIGIR presença (é onde o responsável fecha a chamada depois do encontro) —
 * o que ela não faz é receber gente nova.
 */
export function turmasQueRecebem(turmas: TurmaGestaoLeve[] | null | undefined): TurmaGestaoLeve[] {
  return (Array.isArray(turmas) ? turmas : []).filter((t) => t && t.status === "aberta");
}

/**
 * O encontro que a tela pré-seleciona no walk-in e na chamada.
 *
 * ⚠️⚠️ COMPARA STRING `YYYY-MM-DD`, NUNCA `new Date(data)`. A string sem horário
 * é lida como meia-noite UTC e no Rio vira 21h do dia ANTERIOR — o encontro de
 * hoje seria o de ontem, e o walk-in do domingo cairia no encontro errado. É a
 * armadilha registrada 4× neste repo (curva do censo, culto de agora, totem
 * Kids, janela do check-in).
 *
 * Ordem: o de HOJE → o próximo futuro → o mais recente que já passou (é onde a
 * chamada atrasada é lançada) → nenhum.
 */
export function encontroSugerido(
  encontros: { id: string; numero?: number | null; data?: string | null }[] | null | undefined,
  hoje: string
): string | null {
  const lista = (Array.isArray(encontros) ? encontros : []).filter((e) => e && e.id);
  if (lista.length === 0) return null;

  const comData = lista.filter((e) => typeof e.data === "string" && e.data);
  const doDia = comData.find((e) => e.data === hoje);
  if (doDia) return doDia.id;

  const futuros = comData.filter((e) => (e.data as string) > hoje).sort((a, b) => (a.data as string).localeCompare(b.data as string));
  if (futuros.length) return futuros[0].id;

  const passados = comData.filter((e) => (e.data as string) < hoje).sort((a, b) => (b.data as string).localeCompare(a.data as string));
  if (passados.length) return passados[0].id;

  // ⚠️ Encontro SEM data existe (o "Check-in legado" do backfill). Ele é
  // destino legítimo de presença, então entra como último recurso em vez de
  // deixar a tela sem nada pra sugerir.
  return lista[0].id;
}

/**
 * O nome de quem está na fila.
 *
 * ⚠️ Nunca devolve string vazia: linha sem nome apareceria como um cartão em
 * branco que ninguém sabe o que é. `next_matriculas.nome` é NOT NULL, mas
 * `sobrenome` não — e a tela recebe o que o servidor mandar.
 */
export function nomeDaPessoa(p: { nome?: string | null; sobrenome?: string | null }): string {
  const n = [p?.nome, p?.sobrenome].filter(Boolean).join(" ").trim();
  return n || "Sem nome";
}

/**
 * A turma que a tela de gestão abre por padrão.
 *
 * ⚠️⚠️ Mesma armadilha do `encontroSugerido`: compara **STRING `YYYY-MM-DD`**,
 * nunca `new Date(data)` — aquela forma é meia-noite UTC e no Rio devolve o dia
 * ANTERIOR, então a tela abriria no domingo passado no meio do domingo.
 *
 * Ordem: a que tem encontro HOJE → a próxima futura → a mais recente que já
 * passou (é onde a chamada atrasada é lançada) → a primeira da lista.
 *
 * ⚠️ Desde 26/08 é 1 turma por domingo com 1 encontro, então "a data da turma" é
 * a data do primeiro encontro dela. Turma sem encontro datado não some da lista
 * — ela só nunca é escolhida por data (entra no último recurso).
 */
export function turmaSugerida(
  turmas: TurmaGestaoLeve[] | null | undefined,
  hoje: string
): string | null {
  const lista = (Array.isArray(turmas) ? turmas : []).filter((t) => t && t.id);
  if (lista.length === 0) return null;

  const com = lista
    .map((t) => ({ id: t.id, data: dataDaTurma(t) }))
    .filter((x): x is { id: string; data: string } => typeof x.data === "string" && !!x.data);

  const hojeMesmo = com.find((x) => x.data === hoje);
  if (hojeMesmo) return hojeMesmo.id;

  const futuras = com.filter((x) => x.data > hoje).sort((a, b) => a.data.localeCompare(b.data));
  if (futuras.length) return futuras[0].id;

  const passadas = com.filter((x) => x.data < hoje).sort((a, b) => b.data.localeCompare(a.data));
  if (passadas.length) return passadas[0].id;

  return lista[0].id;
}

/** A data que representa a turma: o encontro mais antigo com data. */
export function dataDaTurma(t: TurmaGestaoLeve | null | undefined): string | null {
  const encs = (Array.isArray(t?.encontros) ? t!.encontros : []).filter(
    (e) => e && typeof e.data === "string" && e.data
  );
  if (encs.length === 0) return null;
  return encs.map((e) => e.data as string).sort((a, b) => a.localeCompare(b))[0];
}

/**
 * Presentes num encontro, a partir do que o detalhe da turma devolve.
 *
 * ⚠️ `presente` é boolean na tabela e a linha só existe pra quem foi marcado —
 * ausente NÃO tem linha. Contar `presencas.length` sem olhar o `presente`
 * incluiria quem foi desmarcado (o toggle remove e reinsere, mas o histórico
 * pode ter linha com `presente: false`).
 */
export function contarPresentes(
  presencas: { encontro_id: string; matricula_id: string; presente: boolean }[] | null | undefined,
  encontroId?: string | null
): number {
  const lista = Array.isArray(presencas) ? presencas : [];
  const vistos = new Set<string>();
  for (const p of lista) {
    if (!p || p.presente !== true) continue;
    if (encontroId && p.encontro_id !== encontroId) continue;
    vistos.add(p.matricula_id);
  }
  return vistos.size;
}
