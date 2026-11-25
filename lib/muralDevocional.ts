/**
 * Mural dos Comentários do Devocional (25/11/2026). Pedido do Marcos:
 * - quem abre escolhe DE QUEM vê os comentários (Meu grupo · Quem serve comigo ·
 *   Toda a igreja), e a escolha fica salva no aparelho;
 * - reações de coração, oração e joinha;
 * - comentário antigo que guardou só a referência ("Tiago 1:5") mostra o texto,
 *   buscado na Bíblia na hora.
 * Regras puras aqui; a tela é `app/(app)/devocional-mural.tsx`.
 */
import { LIVROS_BIBLIA, type LivroBiblico, type VersiculoLivre } from "./bibliaLivre";

export type FiltroMural = "grupo" | "servir" | "igreja";
export const FILTRO_PADRAO: FiltroMural = "igreja";
export const CHAVE_FILTRO_MURAL = "cbrio.devocional.mural.filtro";

export function normalizarFiltro(valor: unknown): FiltroMural {
  return valor === "grupo" || valor === "servir" || valor === "igreja" ? valor : FILTRO_PADRAO;
}

export type TipoReacao = "coracao" | "oracao" | "joinha";
export const REACOES: { tipo: TipoReacao; emoji: string; rotulo: string }[] = [
  { tipo: "coracao", emoji: "❤️", rotulo: "Amei" },
  { tipo: "oracao", emoji: "🙏", rotulo: "Orando" },
  { tipo: "joinha", emoji: "👍", rotulo: "Amém" },
];

export type EstadoReacoes = { reacoes: Partial<Record<TipoReacao, number>>; minhas: TipoReacao[] };

/** Liga/desliga a reação na tela antes da resposta do servidor. */
export function alternarReacao(estado: EstadoReacoes, tipo: TipoReacao): EstadoReacoes {
  const tinha = estado.minhas.includes(tipo);
  const atual = estado.reacoes[tipo] ?? 0;
  return {
    reacoes: { ...estado.reacoes, [tipo]: Math.max(0, atual + (tinha ? -1 : 1)) },
    minhas: tinha ? estado.minhas.filter(t => t !== tipo) : [...estado.minhas, tipo],
  };
}

/**
 * "Tiago 1:5" · "1 Coríntios 13:4,7" · "Salmos 23:1-3" → livro, capítulo e versículos.
 * Referência sem versículo ou que não casa com um livro conhecido devolve null.
 */
export function lerReferencia(referencia: string | null | undefined): { livro: LivroBiblico; capitulo: number; versos: number[] } | null {
  const casou = (referencia ?? "").trim().match(/^(.+?)\s+(\d+):([\d,\s-]+)$/);
  if (!casou) return null;
  const livro = LIVROS_BIBLIA.find(l => l.nome.toLowerCase() === casou[1].trim().toLowerCase());
  const capitulo = Number(casou[2]);
  if (!livro || !capitulo || capitulo > livro.capitulos) return null;
  const versos = new Set<number>();
  for (const parte of casou[3].split(",")) {
    const [a, b] = parte.split("-").map(x => Number(x.trim()));
    if (!a) continue;
    const fim = b && b >= a ? Math.min(b, a + 175) : a;
    for (let v = a; v <= fim; v++) versos.add(v);
  }
  return versos.size ? { livro, capitulo, versos: [...versos].sort((x, y) => x - y) } : null;
}

/** Junta o texto dos versículos citados, na ordem do capítulo. */
export function textoDosVersos(versiculos: VersiculoLivre[], versos: number[]): string {
  return versiculos.filter(v => versos.includes(v.verse)).map(v => v.text.trim()).join(" ");
}
