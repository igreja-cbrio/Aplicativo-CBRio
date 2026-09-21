// ============================================================================
// ORDEM DA LISTA DE PESSOAS DO GRUPO (21/09/2026 · pedido dos líderes)
//
// Trazido pelo Marcos depois da reunião de lançamento: *"na tela de pessoas no
// grupo, deixar por ordem alfabética padrão, mas ter uma pequena opção de
// classificar por ordem de permissão; aí se você toca vira permissão e se você
// toca vira alfabética."*
//
// ⚠️ O QUE ESTAVA ERRADO: a lista vinha na ordem em que as pessoas ENTRARAM
// (`order('created_at')` no servidor). Num grupo que virou de temporada, isso
// é a ordem do import — ou seja, ordem nenhuma pra quem está procurando um
// nome. Com 57 pessoas no maior roster, achar alguém virava rolagem.
//
// ⚠️ A régua vive no `lib/` e não dentro do .tsx porque régua em componente não
// roda no CI — mesma lição da máscara de data (15/09) e da de CPF antes dela.
//
// ⚠️ ORDENAR É SÓ EXIBIÇÃO: a ordem NÃO muda quem está no grupo nem o que vai
// pro servidor. A chamada lê a mesma lista, então ela também fica alfabética —
// que é o que o líder quer quando está conferindo nome por nome no encontro.
// ============================================================================
import { normalizarBusca } from "@/lib/buscaTexto";

export type OrdemRoster = "alfabetica" | "funcao";

/**
 * Peso de cada função na ordem "por permissão". Menor = mais no topo.
 *
 * ⚠️ `co_lider`/`colider` continuam aqui só pra LER dado histórico: o termo
 * morreu em 25/08/2026 e quem tinha virou `lider_treinamento`. Função
 * desconhecida cai no fim (99) em vez de sumir — lista que esconde gente é pior
 * que lista fora de ordem.
 */
const PESO: Record<string, number> = {
  lider: 0,
  co_lider: 1,
  colider: 1,
  lider_treinamento: 1,
  supervisor: 2,
  coordenador: 3,
  membro: 4,
  frequentador: 5,
  visitante: 6,
};

const peso = (funcao?: string | null): number => {
  const p = PESO[String(funcao || "").trim()];
  return p == null ? 99 : p;
};

/**
 * Compara nomes ignorando acento e caixa — "Ália" e "Alia" ficam juntas, e
 * "ana" não vai parar depois de "Zé" por causa da maiúscula.
 *
 * ⚠️ Sem `localeCompare` com locale: o Hermes do React Native nem sempre traz
 * ICU completo, e o resultado muda de aparelho pra aparelho. `normalizarBusca`
 * já é a régua de texto da casa e roda igual em todo lugar.
 */
function comparaNome(a?: string | null, b?: string | null): number {
  const na = normalizarBusca(a);
  const nb = normalizarBusca(b);
  if (na === nb) return 0;
  return na < nb ? -1 : 1;
}

export type ItemRoster = {
  nome?: string | null;
  funcao?: string | null;
  membro_id?: string | null;
};

/**
 * Devolve uma CÓPIA ordenada (nunca mexe no array original, que é o estado da
 * tela).
 *
 * @param liderPrincipalId `mem_grupos.lider_id` — na ordem por permissão, quem
 *   recebe o WhatsApp do grupo vem em primeiro, mesmo que a `funcao` dela no
 *   roster seja `frequentador` (é o caso comum: em 86 dos 102 grupos a líder
 *   não tem função de líder na própria linha do roster).
 */
export function ordenarRoster<T extends ItemRoster>(
  lista: T[],
  ordem: OrdemRoster,
  liderPrincipalId?: string | null,
): T[] {
  const copia = [...(lista || [])];
  if (ordem === "alfabetica") {
    return copia.sort((a, b) => comparaNome(a?.nome, b?.nome));
  }
  return copia.sort((a, b) => {
    const pa = liderPrincipalId && a?.membro_id === liderPrincipalId ? -1 : peso(a?.funcao);
    const pb = liderPrincipalId && b?.membro_id === liderPrincipalId ? -1 : peso(b?.funcao);
    if (pa !== pb) return pa - pb;
    return comparaNome(a?.nome, b?.nome);
  });
}

/** A próxima ordem no toque (o controle é um alternador só). */
export function proximaOrdem(atual: OrdemRoster): OrdemRoster {
  return atual === "alfabetica" ? "funcao" : "alfabetica";
}
