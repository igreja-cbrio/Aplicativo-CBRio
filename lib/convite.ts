// ============================================================================
// O LINK QUE O LÍDER COMPARTILHA (10/08/2026 · apontamento 2)
//
// Pedido do Marcos: *"na aba de compartilhar grupo, ficou ótimo, tem como
// colocar o link de inscrição daquele grupo específico, não do link geral, pro
// líder mandar o link do próprio grupo."*
//
// ⚠️⚠️ ISSO JÁ ERA POSSÍVEL, e o comentário no código dizia o contrário. Ele
// afirmava que *"a página pública não aceita parâmetro de grupo"* — falso desde
// antes de 07/08. Conferido em produção em 10/08: `/inscricao-grupos?grupo=<id>`
// responde 200, `GET /api/public/grupos/<id>` responde 200, e o próprio ERP já
// usa esse formato no popup do mapa. Comentário desatualizado é pior que
// comentário ausente: ele impede o conserto.
//
// ⚠️⚠️ MAS NEM TODO GRUPO PODE RECEBER LINK PRÓPRIO. Medido em 10/08: **9 dos
// 102 grupos ativos são `modo_inscricao='fechado'`** ("por convite do líder"), e
// o backend responde **403** pra quem tenta entrar por link. Mandar o link
// específico desses transformaria o convite do líder num link que recusa todo
// mundo — hoje o link geral ao menos funciona. Por isso a régua decide, e não a
// tela.
// ============================================================================

/** A porta pública de inscrição em grupos. */
const BASE_INSCRICAO = "https://www.cbrio.org/inscricao-grupos";

export type GrupoParaLink = {
  id?: string | null;
  /** `mem_grupos.modo_inscricao`: 'temporada' | 'sempre_aberto' | 'fechado'. */
  modo_inscricao?: string | null;
};

/**
 * Link de inscrição pra compartilhar.
 *
 * · grupo normal → link DIRETO nele (a pessoa já cai no formulário certo);
 * · grupo por convite, ou sem id → link GERAL (a pessoa escolhe na lista).
 *
 * ⚠️ Usa `www.` de propósito: o apex `cbrio.org` responde 307, e redirecionamento
 * em link colado no WhatsApp é uma chance a mais de dar errado (é a mesma lei
 * que `lib/api.ts` já segue).
 */
export function linkDeInscricao(grupo: GrupoParaLink | null | undefined): string {
  const id = String(grupo?.id ?? "").trim();
  if (!id) return BASE_INSCRICAO;
  // ⚠️⚠️ GRUPO 'fechado' TAMBÉM GANHA O LINK PRÓPRIO (Marcos · 11/08/2026).
  // Eu tinha feito o contrário — caía no link geral, porque o backend recusava
  // com 403. Era justamente o caso em que o líder MAIS precisa do link: "por
  // convite do líder" só existe se o líder puder convidar. O backend liberou
  // junto (`publicGrupos.js` + `utils/entradaGrupoApp.js`); o grupo segue fora
  // de toda lista pública, e a inscrição segue virando pedido pra ele aprovar.
  return `${BASE_INSCRICAO}?grupo=${encodeURIComponent(id)}`;
}

/**
 * O grupo só entra por convite do líder?
 *
 * ⚠️ Só `'fechado'` trava. `'temporada'` e `'sempre_aberto'` aceitam link — e
 * quando a temporada está fechada a própria página avisa, o que é degradação
 * honesta, não erro.
 */
export function ehPorConvite(grupo: GrupoParaLink | null | undefined): boolean {
  return String(grupo?.modo_inscricao ?? "").trim().toLowerCase() === "fechado";
}

/**
 * A mensagem muda com o link: com link direto, "é só entrar por aqui"; com link
 * geral, a pessoa PRECISA saber que tem que achar o grupo na lista.
 *
 * ⚠️ Trocar o link sem trocar o texto é o pior desfecho: a mensagem mandaria
 * procurar na lista um grupo que já está pré-selecionado, ou — pior — mandaria
 * entrar direto num link que cai na lista geral.
 */
export function precisaEscolherNaLista(grupo: GrupoParaLink | null | undefined): boolean {
  return linkDeInscricao(grupo) === BASE_INSCRICAO;
}
