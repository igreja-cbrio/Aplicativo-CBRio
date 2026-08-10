// ============================================================================
// A RÉGUA DO HERÓI DA TELA DE GRUPO (05/08/2026)
//
// O redesenho aprovado pelo Marcos tem UM protagonista: "o que o líder precisa
// fazer agora". Este arquivo decide qual das quatro coisas é essa — e é código
// PURO de propósito (`lib/`, sem React, sem nativo) porque régua dentro de
// `.tsx` não passa pelo portão do CI.
//
// ⚠️⚠️ `dia_semana = 0` é DOMINGO, e 0 é FALSY em JS. Testar com `!diaSemana`
// jogaria todo grupo de domingo em "sem dia definido" — é a mesma armadilha
// registrada no CLAUDE.md do ERP (58 campos derivados errados em 29/07) e por
// isso ela tem mutante próprio em `scripts/mutantes.mjs`.
//
// ⚠️ O "hoje" é INJETADO (nunca `new Date()` aqui dentro): teste que lê o
// relógio da máquina passa ou falha conforme a hora do dia — a lição do
// `faixaEtaria.test.ts` do ERP. Quem chama passa `hojeBRT()` (`lib/dataBRT.ts`),
// porque dia de operação da igreja é BRT, não UTC.
// ============================================================================

/** Encontro já registrado (o que `GET /app/grupos/:id/encontros` devolve). */
export type EncontroRegistrado = {
  data: string; // 'YYYY-MM-DD'
  presentes?: number | null;
};

export type EstadoEncontro =
  /** Passou o dia do grupo e ninguém registrou. É o que mais importa. */
  | { tipo: "atrasado"; data: string; dias: number }
  /** Registrou na última ocorrência (mostra por pouco tempo — é confirmação). */
  | { tipo: "registrado"; data: string; presentes: number | null; proxima: string | null }
  /** O caso normal: o encontro que vem (pode ser hoje). */
  | { tipo: "proximo"; data: string; dias: number }
  /** Grupo diário ou sem dia definido: não há "próxima terça" a calcular. */
  | { tipo: "sem_dia" };

/** Quantos dias a confirmação de "registrado" continua no lugar do próximo. */
const DIAS_MOSTRAR_REGISTRO = 2;
/**
 * Tolerância pra casar encontro × ocorrência. O líder às vezes registra a terça
 * na quarta e digita a data de quarta — sem esta folga o grupo apareceria como
 * "atrasado" tendo registrado.
 */
const TOLERANCIA_DIAS = 1;

const MS_DIA = 86400000;

/** 'YYYY-MM-DD' → Date ao MEIO-DIA UTC. */
function doDia(iso: string): Date {
  // ⚠️ Meio-dia, não meia-noite: `new Date('2026-08-05')` é 00:00 UTC = 21h do
  // dia ANTERIOR no Rio. Ancorar ao meio-dia deixa a conta de dias imune a fuso.
  return new Date(iso + "T12:00:00Z");
}

function paraIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Diferença em dias inteiros entre dois 'YYYY-MM-DD' (b − a). */
export function diasEntre(a: string, b: string): number {
  return Math.round((doDia(b).getTime() - doDia(a).getTime()) / MS_DIA);
}

/** Dia da semana de um 'YYYY-MM-DD' (0=domingo), sem depender do fuso local. */
export function diaDaSemana(iso: string): number {
  return doDia(iso).getUTCDay();
}

/**
 * A ocorrência do `diaSemana` mais recente que já chegou (inclui o próprio
 * `hoje` quando hoje é o dia do grupo).
 */
export function ultimaOcorrencia(hoje: string, diaSemana: number): string {
  const atras = (diaDaSemana(hoje) - diaSemana + 7) % 7;
  return paraIso(new Date(doDia(hoje).getTime() - atras * MS_DIA));
}

/** A próxima ocorrência DEPOIS de hoje (nunca hoje). */
export function proximaOcorrencia(hoje: string, diaSemana: number): string {
  const frente = ((diaSemana - diaDaSemana(hoje) + 7) % 7) || 7;
  return paraIso(new Date(doDia(hoje).getTime() + frente * MS_DIA));
}

/** Acha o encontro registrado que corresponde a uma ocorrência (± tolerância). */
export function registroDaOcorrencia(
  encontros: EncontroRegistrado[],
  ocorrencia: string
): EncontroRegistrado | null {
  let melhor: EncontroRegistrado | null = null;
  let melhorDist = Infinity;
  for (const e of encontros || []) {
    if (!e || !e.data) continue;
    const dist = Math.abs(diasEntre(ocorrencia, String(e.data).slice(0, 10)));
    if (dist <= TOLERANCIA_DIAS && dist < melhorDist) {
      melhor = e;
      melhorDist = dist;
    }
  }
  return melhor;
}

export function estadoDoEncontro(args: {
  diaSemana: number | null | undefined;
  encontros: EncontroRegistrado[];
  hoje: string;
}): EstadoEncontro {
  const { diaSemana, encontros, hoje } = args;

  // ⚠️ `== null`, NUNCA `!diaSemana` — domingo é 0.
  if (diaSemana == null || diaSemana < 0 || diaSemana > 6) return { tipo: "sem_dia" };

  const ultima = ultimaOcorrencia(hoje, diaSemana);
  const proxima = proximaOcorrencia(hoje, diaSemana);
  const registro = registroDaOcorrencia(encontros, ultima);

  // Hoje é o dia do grupo e ainda não registrou: é o PRÓXIMO (hoje), não
  // atrasado — o dia ainda está acontecendo.
  if (ultima === hoje && !registro) return { tipo: "proximo", data: hoje, dias: 0 };

  if (registro) {
    const desde = diasEntre(ultima, hoje);
    // A confirmação cumpre o papel por pouco tempo; depois o útil é o próximo.
    if (desde <= DIAS_MOSTRAR_REGISTRO) {
      return {
        tipo: "registrado",
        data: ultima,
        presentes: registro.presentes ?? null,
        proxima,
      };
    }
    return { tipo: "proximo", data: proxima, dias: diasEntre(hoje, proxima) };
  }

  // Passou e ninguém registrou.
  return { tipo: "atrasado", data: ultima, dias: diasEntre(ultima, hoje) };
}

// ── texto pra tela ─────────────────────────────────────────────────────────
const DIAS_NOME = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

/** "Terça, 12 de agosto" — o texto grande do herói. */
export function dataLonga(iso: string): string {
  const d = doDia(iso);
  return `${DIAS_NOME[d.getUTCDay()]}, ${d.getUTCDate()} de ${MESES[d.getUTCMonth()]}`;
}

/** "Terça, 20h" / "Terça, 20:30" — a identidade do grupo, na barra de cima. */
export function quandoCurto(diaSemana: number | null | undefined, horario?: string | null): string {
  const partes: string[] = [];
  if (diaSemana != null && diaSemana >= 0 && diaSemana <= 6) partes.push(DIAS_NOME[diaSemana]);
  if (horario) {
    const [h, m] = String(horario).split(":");
    partes.push(m && m !== "00" ? `${h}:${m}` : `${Number(h)}h`);
  }
  return partes.join(", ");
}

/** Só a HORA, do jeito da casa: "20h" quando é redonda, "20:30" quando não. */
export function horaCurta(horario?: string | null): string {
  if (!horario) return "";
  const [h, m] = String(horario).trim().split(":");
  if (h == null || h === "" || Number.isNaN(Number(h))) return "";
  return m && m !== "00" ? `${h}:${m}` : `${Number(h)}h`;
}

/**
 * "Terça, 20 de agosto · 19:30" — data E HORA (10/08/2026 · item 4).
 *
 * ⚠️⚠️ POR QUE ISTO EXISTE: a prévia dos encontros do NEXT usava
 * `formatRelativo`, que devolve **"Em 5 dias"** — nem data, nem hora. O pedido
 * do Marcos era literalmente o oposto: *"eu nem consegui ver a data nem nada"*.
 * "Em 5 dias" não responde "que dia é?" nem "que hora é?", que é o que a pessoa
 * precisa pra decidir se consegue ir.
 *
 * ⚠️ Sem hora, devolve só a data — não inventa "00:00", que soaria como
 * meia-noite. Hora ausente é comum: `NextEncontro.horario` é opcional.
 */
export function dataComHora(iso: string, horario?: string | null): string {
  const dia = dataLonga(iso);
  const hora = horaCurta(horario);
  return hora ? `${dia} · ${hora}` : dia;
}

/** "faltam 4 dias" · "é hoje" · "é amanhã" · "há 3 dias". */
export function distanciaEmTexto(dias: number): string {
  if (dias === 0) return "é hoje";
  if (dias === 1) return "é amanhã";
  if (dias > 1) return `faltam ${dias} dias`;
  if (dias === -1) return "há 1 dia";
  return `há ${Math.abs(dias)} dias`;
}
