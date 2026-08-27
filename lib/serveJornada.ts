/**
 * "Esta pessoa SERVE?" — régua PURA, sem nenhuma dependência (é o que a deixa
 * testável no vitest, que roda em node puro: `lib/jornada.ts` importa Supabase
 * e React Native e não pode ser carregado no teste).
 *
 * ⚠️⚠️ ISTO ERA UM FALSO NEGATIVO EM MASSA, corrigido em 27/08/2026 depois do
 * relato do Marcos sobre uma líder que serve há meses e via "Comece a servir"
 * na própria jornada. A tela perguntava `!!me.inscricao` — ou seja, **se a
 * pessoa preencheu o FORMULÁRIO público de voluntariado**. Formulário não é
 * serviço: quem entrou pelo Planning Center ou foi integrada pela liderança
 * nunca preencheu um.
 *
 * **Medido em produção: das 598 pessoas com vínculo ATIVO de voluntário, 314
 * (52%) não têm inscrição nenhuma.** Todas viam a própria jornada dizendo que
 * não servem. É a mesma classe do bug de 13/08 (ler o telefone só de
 * `vol_profiles` e concluir "não tem"): confundir "não procurei no lugar certo"
 * com "a pessoa não faz".
 *
 * A ordem vai do sinal mais forte pro mais fraco:
 *  1. `serve` — vínculo vivo em `mem_voluntarios` (a MESMA régua da NSM e do
 *     /painel do ERP);
 *  2. `voluntario_ativo` — há perfil do Planning Center alcançável por ESTA
 *     conta (só 35 dos 938 perfis têm `auth_user_id`, então alcança pouca gente);
 *  3. `inscricao` — o formulário, que é o que existia antes.
 *
 * Os passos 2 e 3 são FALLBACK de deploy em 2 etapas: este bundle pode estar
 * falando com um servidor que ainda não manda `serve`.
 */
export function decidirServe(me: {
  serve?: boolean | null;
  voluntario_ativo?: boolean;
  inscricao?: unknown;
}): boolean {
  if (me.serve === true) return true;
  // ⚠️⚠️ `false` é RESPOSTA do servidor e MANDA — não cai no fallback. Sem esta
  // linha, uma inscrição antiga de quem PAROU de servir ressuscitaria o check,
  // e a jornada afirmaria um serviço que acabou.
  if (me.serve === false) return false;
  return me.voluntario_ativo === true || !!me.inscricao;
}
