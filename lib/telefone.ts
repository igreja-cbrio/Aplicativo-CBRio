// ============================================================================
// TELEFONE · limite de dígitos + máscara com DDD (07/08/2026)
//
// Relato do Marcos ao criar conta: *"o telefone não tem limite de dígitos,
// podemos colocar um limite para facilitar e incluir os dois primeiros em
// parênteses para deixar claro que precisa colocar DDD"*.
//
// O campo aceitava qualquer quantidade de dígitos e só dizia "DDD + número" no
// placeholder. Isso importa além da estética: o Contrato de porta exige
// **10 ou 11 dígitos** (DDD + número) e o servidor recusa fora disso — a pessoa
// só descobria no fim do cadastro. E telefone torto é o que quebra o dedup por
// telefone do sistema inteiro (a lição dos 15 cadastros com "+55" grudado).
// ============================================================================

/** DDD + número: 10 (fixo) ou 11 (celular com o 9). */
export const MAX_DIGITOS_BR = 11;

/**
 * Fora do Brasil não mascaramos nem adivinhamos formato — só evitamos campo
 * infinito. 15 é o teto do E.164 (país incluído), então sobra folga.
 */
export const MAX_DIGITOS_INTERNACIONAL = 15;

/** Quantos dígitos o campo aceita, pelo código do país escolhido. */
export function limiteDigitos(dial: string): number {
  return dial === "55" ? MAX_DIGITOS_BR : MAX_DIGITOS_INTERNACIONAL;
}

/**
 * `21999998888` → `(21) 99999-8888` · `2133334444` → `(21) 3333-4444`.
 *
 * ⚠️ O parêntese abre já no 1º dígito de propósito: é ele que comunica "aqui
 * começa o DDD" enquanto a pessoa digita — que era o pedido.
 * ⚠️ TRUNCA no limite: sem isso a máscara aceita 20 dígitos e o servidor recusa
 * lá na frente, sem a pessoa saber por quê.
 */
export function mascararTelefoneBR(digitos: string): string {
  const d = digitos.replace(/\D/g, "").slice(0, MAX_DIGITOS_BR);
  if (d.length === 0) return "";
  if (d.length <= 2) return `(${d}`;
  const ddd = d.slice(0, 2);
  const resto = d.slice(2);
  if (resto.length <= 4) return `(${ddd}) ${resto}`;
  // Celular tem 9 dígitos depois do DDD; fixo, 8. O hífen cai em lugar
  // diferente nos dois — daí o corte depender do tamanho, não ser fixo.
  const corte = resto.length > 8 ? 5 : 4;
  return `(${ddd}) ${resto.slice(0, corte)}-${resto.slice(corte)}`;
}

/** O que MOSTRAR no campo, conforme o país (só o Brasil tem máscara nossa). */
export function exibirTelefone(digitos: string, dial: string): string {
  const d = digitos.replace(/\D/g, "");
  if (dial === "55") return mascararTelefoneBR(d);
  return d.slice(0, MAX_DIGITOS_INTERNACIONAL);
}

/**
 * O que GUARDAR no estado: só dígitos, já cortados no limite do país.
 * ⚠️ O estado NUNCA guarda a máscara — quem monta o `+55…` do cadastro
 * concatena isto direto, e parêntese ali viraria telefone inválido no banco.
 */
export function digitosTelefone(valorDigitado: string, dial: string): string {
  return valorDigitado.replace(/\D/g, "").slice(0, limiteDigitos(dial));
}
