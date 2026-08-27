// ============================================================================
// A RESPOSTA DE /app/voluntariado/me · normalização (11/08/2026)
//
// Relato do Marcos: *"Pedro Fernandes, nosso responsável da produção que está
// escalado em todos os cultos, ao abrir o app e entrar em servir apareceu as
// áreas para ele escolher e o pedido de quero ser voluntário."*
//
// ⚠️⚠️ ESTE ARQUIVO EXISTE POR CAUSA DE UM CAMPO QUE CHEGAVA ERRADO EM SILÊNCIO.
//
// `getVoluntariadoMe()` fazia `return obj as VoluntariadoMe` — um CAST, que não
// confere nada. Se `voluntario_ativo` vier ausente (renomeado no servidor, ou um
// 304 servindo corpo antigo), ele chega `undefined`, `estadoVoluntariado` cai no
// status da inscrição e quem serve há anos **volta a ver o formulário de "quero
// ser voluntário"** — exatamente o defeito que o Marcos reportou, ressuscitado
// sem nenhum erro de TypeScript e sem falhar teste nenhum.
//
// Aqui `voluntario_ativo` só é `true` quando o servidor disse `true` de verdade.
// ============================================================================

import { type VoluntariadoMe } from "./api";

/**
 * Normaliza a resposta do servidor.
 *
 * ⚠️ Aceita envelope (`{ data: {...} }`) ou objeto cru — o backend do CBRio
 * responde cru, mas o helper antigo já tolerava os dois e tirar isso seria
 * mexer num comportamento que não é o alvo desta correção.
 */
export function normalizarVoluntariadoMe(raw: unknown): VoluntariadoMe {
  const obj = desembrulhar(raw);

  /**
   * ⚠️ `=== true` NÃO É PARANOIA, é o ponto do arquivo.
   *
   * `!!obj.voluntario_ativo` seria igual pra `true`, mas também aceitaria a
   * STRING `"false"` como verdadeira — e string é o que chega quando alguém põe
   * o valor num query param ou num header pelo caminho. Aqui o erro que importa
   * é o oposto (dizer "não é voluntário" pra quem é), então a régua exige o
   * booleano `true` do servidor e trata qualquer outra coisa como "não sei".
   */
  const voluntario_ativo = obj?.voluntario_ativo === true;
  // ⚠️ TRÊS estados de propósito: true · false · null ("não sei"). Colapsar em
  // boolean aqui faria a jornada afirmar "não serve" quando o servidor apenas
  // não respondeu — que é o defeito que esta leva veio consertar.
  const serve = obj?.serve === true ? true : obj?.serve === false ? false : null;

  return {
    inscricao: normalizarInscricao(obj?.inscricao),
    voluntario_ativo,
    serve,
    ...(obj?.escalas ? { escalas: obj.escalas } : {}),
  } as VoluntariadoMe;
}

type Cru = {
  voluntario_ativo?: unknown;
  serve?: unknown;
  inscricao?: unknown;
  escalas?: VoluntariadoMe["escalas"];
};

function desembrulhar(raw: unknown): Cru | null {
  if (!raw || typeof raw !== "object") return null;
  if ("data" in raw) {
    const dentro = (raw as { data: unknown }).data;
    if (dentro && typeof dentro === "object") return dentro as Cru;
  }
  return raw as Cru;
}

/**
 * ⚠️ Inscrição SEM `status` vira `null`, não um objeto meio-preenchido: o
 * `status` é o que a régua de `lib/volStatus.ts` lê pra decidir a tela, e um
 * objeto com `status: undefined` faria a régua ler "" e responder "nenhum" —
 * dizendo que a pessoa nunca se inscreveu quando ela tem inscrição na fila.
 */
function normalizarInscricao(v: unknown): VoluntariadoMe["inscricao"] {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const status = typeof o.status === "string" ? o.status.trim() : "";
  if (!status) return null;
  return {
    id: String(o.id ?? ""),
    status,
    area: typeof o.area === "string" ? o.area : null,
    ministerios_interesse: Array.isArray(o.ministerios_interesse)
      ? (o.ministerios_interesse as string[])
      : null,
    integrado_em: typeof o.integrado_em === "string" ? o.integrado_em : null,
  } as VoluntariadoMe["inscricao"];
}
