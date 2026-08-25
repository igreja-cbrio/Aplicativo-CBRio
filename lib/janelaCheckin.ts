// ============================================================================
// JANELA DO CHECK-IN PELO SUPERVISOR = O DIA DO CULTO, EM BRT (25/08/2026)
//
// Pedido do Matheus: o supervisor faz check-in dos voluntários da área dele pelo
// app, **só nos dias de culto** — pra a igreja não ficar refém de um único ponto
// de check-in (hoje a sala de voluntários). Ele escolheu DIA INTEIRO, não uma
// faixa de horas em volta do culto.
//
// ⚠️⚠️ ESTA RÉGUA TEM QUE CONCORDAR COM O SERVIDOR. O backend decide o mesmo em
// `backend/utils/janelaCulto.js` (`ehDiaDoCulto`) e responde **403** fora da
// janela. Se o app calcular diferente, o botão aparece e o toque falha — que é
// pior que o botão não aparecer.
//
// ⚠️⚠️ A ARMADILHA: culto de domingo 19h é **22h UTC**. Das 21h BRT em diante o
// UTC já virou o dia seguinte, então `toISOString().slice(0,10)` **fecha a
// janela no meio do culto da noite** — exatamente quando o supervisor está
// batendo os check-ins. É a mesma classe do bug de 05/08 que criou o
// `lib/dataBRT.ts` ("21h no Rio ainda é hoje"), e apareceu de novo aqui.
//
// ⚠️ Usa `Intl` (timeZone), não offset fixo de −3h como o `hojeBRT()` vizinho.
// O comentário do `dataBRT.ts` já registra que o offset fixo é dívida ("se o
// horário de verão voltar, isto tem que virar Intl") — código NOVO não entra
// aumentando essa dívida. O backend também usa `Intl`, então os dois lados
// calculam pelo mesmo mecanismo.
// ============================================================================

const TZ = "America/Sao_Paulo";

/** `YYYY-MM-DD` do instante `iso` no fuso da igreja. `null` se não for data. */
export function diaDoInstanteBRT(iso: string | Date | null | undefined): string | null {
  if (!iso) return null;
  const d = iso instanceof Date ? iso : new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  // 'en-CA' devolve YYYY-MM-DD, que compara e ordena como string.
  return d.toLocaleDateString("en-CA", { timeZone: TZ });
}

export type JanelaCheckin =
  | { ok: true; dia: string }
  | { ok: false; motivo: "sem_data" | "fora_do_dia"; dia: string | null };

/**
 * O culto agendado em `scheduledAt` acontece HOJE (dia BRT)?
 * `agora` é injetável: teste no portão deste repo não pode depender do relógio
 * da máquina (lição do `faixaEtaria.test.ts` do ERP).
 */
export function ehDiaDoCulto(
  scheduledAt: string | Date | null | undefined,
  agora: Date = new Date(),
): JanelaCheckin {
  const dCulto = diaDoInstanteBRT(scheduledAt);
  const dHoje = diaDoInstanteBRT(agora);
  if (!dCulto || !dHoje) return { ok: false, motivo: "sem_data", dia: dCulto };
  return dCulto === dHoje ? { ok: true, dia: dCulto } : { ok: false, motivo: "fora_do_dia", dia: dCulto };
}

/** Dos cultos que o supervisor enxerga, só os de HOJE — a lista do check-in. */
export function cultosDeHoje<T extends { scheduled_at: string | null }>(
  servicos: T[] | null | undefined,
  agora: Date = new Date(),
): T[] {
  return (servicos || []).filter((s) => ehDiaDoCulto(s.scheduled_at, agora).ok);
}
