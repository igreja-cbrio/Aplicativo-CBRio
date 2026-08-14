// ============================================================================
// lib/marcadoresJornada · marcadores de jornada do ROSTER (visão do líder)
// ============================================================================
// Pedido do Arthur Serpa, ideia do Pr. Nélio (13/08/2026): "o líder de grupo
// vê rapidamente em quais etapas da jornada cada pessoa da sua turma está e dá
// um direcionamento mais intencional a partir daí".
//
// ⚠️ Isto NÃO é o `lib/jornada.ts`. Aquele é a jornada da PRÓPRIA pessoa (tela
// "Sua jornada"), lida direto do Supabase com a credencial dela. Aqui é a
// jornada DE OUTRAS pessoas, e por isso quem decide o que sai é o SERVIDOR:
// o app só desenha o que `GET /app/grupos/:id/membros` mandou.
//
// ⚠️⚠️ O marcador de GENEROSIDADE nunca chega nesta tela — o backend o corta
// pra quem entra por esta rota (decisão do Matheus, 13/08/2026: histórico de
// contribuição não fica aberto pro líder de grupo). Se um dia aparecer aqui,
// é bug de servidor, não de tela — não "consertar" desenhando o chip.
//
// ⚠️ A LEI: marcador diz o que o sistema tem REGISTRO de, não o que a pessoa
// fez. Ausência de flag NÃO é prova de que a pessoa não passou pela etapa. Por
// isso a tela não escreve "não batizado" em lugar nenhum.
// ============================================================================

export type ChaveMarcador =
  | "batismo" | "next" | "grupo" | "servir" | "devocional" | "generosidade";

/** Payload que o servidor anexa em cada pessoa do roster. */
export type Marcadores = {
  chaves: ChaveMarcador[];
  detalhes?: Partial<Record<ChaveMarcador, string>>;
  sensiveis_ocultos?: boolean;
  /** Sinais que o servidor não conseguiu ler NESTA resposta. */
  indisponiveis?: string[];
};

type Info = { curto: string; cor: string };

/**
 * ⚠️ `grupo` fica de fora do desenho DESTA tela de propósito: todo mundo do
 * roster está em grupo (é o roster), então o chip seria ruído em 100% das
 * linhas. Ele continua vindo do servidor — quem some é o desenho.
 */
export const OCULTOS_NO_ROSTER: ChaveMarcador[] = ["grupo"];

export const MARCADOR_INFO: Record<ChaveMarcador, Info> = {
  batismo:      { curto: "Batizado", cor: "#0369a1" },
  next:         { curto: "Next",     cor: "#047857" },
  grupo:        { curto: "Grupo",    cor: "#1d4ed8" },
  servir:       { curto: "Serve",    cor: "#7c3aed" },
  devocional:   { curto: "Devocional", cor: "#b45309" },
  generosidade: { curto: "Contribui", cor: "#be185d" },
};

/** Chaves que a linha do roster desenha, na ordem da jornada. */
export function chavesVisiveis(m?: Marcadores | null): ChaveMarcador[] {
  const ordem: ChaveMarcador[] =
    ["batismo", "next", "grupo", "servir", "devocional", "generosidade"];
  const tem = new Set(m?.chaves || []);
  return ordem.filter(
    (c) => tem.has(c) && !OCULTOS_NO_ROSTER.includes(c) && !!MARCADOR_INFO[c],
  );
}
