// ============================================================================
// DIA DE OPERAÇÃO DA IGREJA = BRT (05/08/2026)
//
// `new Date().toISOString().slice(0,10)` devolve o dia **UTC**: das 21h do Rio
// em diante ele já virou. Isso apareceu 3 vezes no mesmo dia — no backend
// (`/app/culto/agora` atribuía a decisão ao culto errado), na lista de próximos
// cultos do app (o culto de quarta, 20h, saía da lista DURANTE o culto) e no
// filtro de indisponibilidade do voluntariado.
//
// Espelha o `hojeBRT()` de `backend/routes/app.js` — os dois lados têm que
// concordar sobre "que dia é hoje", senão o app pede uma janela e o servidor
// responde outra.
//
// ⚠️ NÃO usar isto pra data que é do APARELHO por natureza (o check-in do
// devocional usa `hojeISO()` local de propósito: o "hoje" de quem lê é o do
// lugar onde a pessoa está). BRT é pra AGENDA DA IGREJA — culto, escala, encontro.
// ⚠️ Offset fixo de −3h: o Brasil não tem horário de verão desde 2019. Se
// voltar, isto (e o `hojeBRT` do backend) tem que virar Intl/timeZone.
// ============================================================================

const MS_BRT = 3 * 60 * 60 * 1000;

/** `YYYY-MM-DD` do dia corrente no fuso da igreja (America/Sao_Paulo). */
export function hojeBRT(): string {
  return new Date(Date.now() - MS_BRT).toISOString().slice(0, 10);
}

/** `YYYY-MM-DD` de `n` dias à frente (ou atrás, com n negativo) em BRT. */
export function diaBRT(n: number): string {
  return new Date(Date.now() - MS_BRT + n * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
}
