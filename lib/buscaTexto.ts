// ============================================================================
// BUSCA POR NOME · sem acento, sem caixa (10/08/2026)
//
// ⚠️ ESTAVA PRESA DENTRO DE `app/(app)/grupos.tsx` (uma `normalizar()` local,
// num `.tsx` que importa react-native). Régua em `.tsx` não roda no portão —
// é a lei da casa, e é a mesma razão por que `lib/ficha.ts` e `lib/teclado.ts`
// existem. Aqui ela sai do arquivo de tela, ganha teste e passa a servir a
// busca da CHAMADA (roster de até 57 nomes, apontamento 1).
//
// ⚠️⚠️ POR QUE IGNORAR ACENTO NÃO É ENFEITE: quem digita no celular, com pressa,
// no meio do encontro, escreve "joao" e não "João" — o teclado nem oferece o til
// sem segurar a tecla. Uma busca sensível a acento simplesmente **não acha**
// metade dos nomes brasileiros (José, Antônio, Conceição), e a pessoa conclui
// que o nome não está no grupo. É o mesmo conserto que os Grupos já receberam no
// ERP em 2026 (busca sem acento + apelido).
// ============================================================================

/** Minúsculas, sem acento, sem espaço nas pontas. */
export function normalizarBusca(s: string | null | undefined): string {
  return String(s ?? "")
    .toLowerCase()
    .normalize("NFD")
    // Remove os diacríticos que o NFD separou (bloco U+0300–U+036F).
    // ⚠️ Escapes explícitos, não os caracteres literais: combinantes soltos no
    // fonte são invisíveis no editor e grudam no caractere anterior quando
    // alguém edita a linha — vira um bug que ninguém enxerga lendo o código.
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

/**
 * O texto casa com o termo buscado?
 *
 * ⚠️ Termo VAZIO casa com tudo, de propósito: é o estado inicial do campo, e
 * a lista tem que aparecer inteira antes de a pessoa digitar qualquer coisa.
 *
 * ⚠️ Busca por SUBSTRING e não por prefixo: gente procura pelo sobrenome ("silva")
 * tanto quanto pelo primeiro nome, e num roster os primeiros nomes se repetem.
 */
export function casaBusca(texto: string | null | undefined, termo: string | null | undefined): boolean {
  const t = normalizarBusca(termo);
  if (!t) return true;
  return normalizarBusca(texto).includes(t);
}

/**
 * Filtra uma lista por um campo de texto.
 *
 * ⚠️ Devolve a lista ORIGINAL quando o termo está vazio — mesma referência, sem
 * criar array novo, pra não disparar render à toa em lista grande.
 */
export function filtrarPorTexto<T>(
  itens: T[],
  termo: string | null | undefined,
  campo: (item: T) => string | null | undefined,
): T[] {
  if (!normalizarBusca(termo)) return itens;
  return itens.filter((i) => casaBusca(campo(i), termo));
}
