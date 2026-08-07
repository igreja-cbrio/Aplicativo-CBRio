// ============================================================================
// TÓPICO DE CANAL REALTIME — por que ele NÃO pode ser fixo (07/08/2026)
//
// A aba Servir caía em "Algo deu errado / Tentar de novo" (o Error Boundary da
// Onda 2) na SEGUNDA vez que era aberta na mesma sessão. Telemetria de produção,
// 2 eventos `render_crash`, com a mensagem literal:
//
//   "cannot add `postgres_changes` callbacks for realtime:voluntariado-<id>
//    after `subscribe()`"
//
// A cadeia, em 3 fatos do supabase-js:
//   1. `RealtimeClient.channel(topico)` REAPROVEITA um canal já registrado com
//      o mesmo tópico, em vez de criar outro;
//   2. `RealtimeChannel.on()` LANÇA quando o canal está joined/joining;
//   3. `removeChannel()` é assíncrono e só desregistra quando o `unsubscribe`
//      é confirmado — o cleanup do efeito não espera por isso.
//
// Ou seja: desmontar e remontar a tela rápido reencontra o canal ANTIGO ainda
// registrado, o `.on()` lança dentro do `useEffect`, e a exceção sobe até a
// raiz. O bug é ANTIGO; a Onda 2 só o tornou visível — antes um throw de efeito
// sem boundary fechava o app inteiro, sem mensagem.
//
// ⚠️ A régua vive aqui, PURA, porque `useVoluntariadoSync` importa supabase e
// react-native e não roda no CI (lei do repo: régua nova em `lib/`, nunca dentro
// de arquivo que o portão não alcança).
// ============================================================================

/** Prefixo dos canais de voluntariado de um membro. */
export function prefixoVoluntariado(membroId: string): string {
  return `voluntariado-${membroId}`;
}

let sequencia = 0;

/**
 * Tópico NOVO a cada montagem.
 *
 * ⚠️ Duas fontes de unicidade de propósito: o relógio sozinho colide quando a
 * tela remonta dentro do mesmo milissegundo (que é exatamente o caso da
 * navegação rápida que produziu o crash), e o contador sozinho reinicia quando
 * o bundle recarrega.
 */
export function topicoVoluntariado(membroId: string): string {
  sequencia += 1;
  return `${prefixoVoluntariado(membroId)}-${Date.now()}-${sequencia}`;
}

/**
 * Dos tópicos JÁ registrados no cliente, quais são canais velhos deste membro
 * (e portanto devem ser removidos antes de abrir o novo).
 *
 * ⚠️ Sem esta limpeza, tópico único troca um bug por outro: os canais órfãos
 * ACUMULAM no cliente e no servidor de realtime a cada abertura da tela —
 * vazamento silencioso, com um `phx_join` a mais por vez.
 *
 * ⚠️ O supabase-js prefixa os tópicos com `realtime:`; comparar sem isso não
 * casa nada e a limpeza vira decoração.
 */
export function canaisObsoletos(topicosRegistrados: string[], membroId: string): string[] {
  const alvo = prefixoVoluntariado(membroId);
  return topicosRegistrados.filter((t) => {
    const semPrefixo = t.startsWith("realtime:") ? t.slice("realtime:".length) : t;
    // `startsWith(alvo)` sozinho pegaria o canal de OUTRO membro cujo uuid
    // comece com o deste — improvável, mas a comparação exata é de graça.
    return semPrefixo === alvo || semPrefixo.startsWith(`${alvo}-`);
  });
}
