/**
 * Disponibilidade DECLARADA na aba Servir · semanas × cultos (09/11/2026).
 *
 * Pedido do Marcos: o voluntário marca em QUAIS SEMANAS do mês pode ser escalado
 * — várias (1 e 3, 2 e 4…), incluindo a 5ª. "Semana N" é a N-ésima vez daquele
 * dia no mês: sábado + 2 = o 2º sábado. Os CULTOS são por time ("Meus times").
 *
 * ⚠️ Quem decide o que vale é o SERVIDOR (`utils/disponibilidadeDeclarada` no
 * ERP): fora do que a pessoa marcou o preenchimento automático não escala, e
 * na escala à mão ela aparece no fim, com aviso. Aqui só se normaliza o que
 * chega e se monta a escolha — régua pura, no portão.
 * ⚠️ Nada marcado = disponível pra tudo. O servidor grava NULL pra "nada" e
 * pra "tudo"; a tela mostra a escolha local enquanto está aberta.
 */

export const SEMANAS_DO_MES = [1, 2, 3, 4, 5] as const;

/** Lista de semanas 1..5, sem repetição, em ordem. Cai na coluna antiga (1 valor). */
export function normalizarSemanas(lista: unknown, legado?: unknown): number[] {
  const nums = (Array.isArray(lista) ? lista : [])
    .map((x) => (typeof x === "number" ? x : typeof x === "string" && x.trim() ? Number(x) : NaN))
    .filter((n) => Number.isInteger(n) && n >= 1 && n <= 5);
  if (nums.length) return [...new Set(nums)].sort((a, b) => a - b);
  const n = typeof legado === "number" ? legado : typeof legado === "string" && legado.trim() ? Number(legado) : NaN;
  return Number.isInteger(n) && n >= 1 && n <= 5 ? [n] : [];
}

/** Liga/desliga um item, mantendo números em ordem. */
export function alternar<T extends number | string>(lista: T[], item: T): T[] {
  const tem = lista.includes(item);
  const nova = tem ? lista.filter((x) => x !== item) : [...lista, item];
  return typeof item === "number"
    ? ([...nova] as number[]).sort((a, b) => a - b) as T[]
    : nova;
}

export type CultoOpcao = { id: string; name: string; recurrence_day: number | null; recurrence_time: string | null };

/** Catálogo de cultos que o servidor mandou (usado em "Meus times"). Não-lista ⇒ `null`. */
export function normalizarCultosOpcoes(v: unknown): CultoOpcao[] | null {
  if (!Array.isArray(v)) return null;
  return v
    .filter((o) => o && typeof o === "object" && (o as { id?: unknown }).id)
    .map((o) => {
      const r = o as Record<string, unknown>;
      return {
        id: String(r.id),
        name: typeof r.name === "string" ? r.name : "",
        recurrence_day: typeof r.recurrence_day === "number" ? r.recurrence_day : null,
        recurrence_time: typeof r.recurrence_time === "string" ? r.recurrence_time : null,
      };
    });
}
