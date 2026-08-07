// ============================================================================
// "NÃO SEI" É DIFERENTE DE "NÃO" (07/08/2026 · Onda 4)
//
// ⚠️⚠️ O DEFEITO QUE ISTO CONSERTA: espalhados pelo app há `catch` que devolvem
// o valor VAZIO como se fosse resposta do servidor. O resultado é que erro de
// rede, timeout ou 429 viram AFIRMAÇÃO FALSA na tela:
//
//   · `temporadaGrupos.ts`  → "inscrições fechadas"  (e a pessoa desiste)
//   · `inscricoesStatus.ts` → "você não está inscrito em nada" (×4 catches)
//   · `useAdminGrupo.ts`    → o líder perde o botão de gerenciar
//   · `jornada.ts`          → devocionais = 0, "não está em grupo", "não foi
//                             batizado" — a jornada oferece passos já dados
//   · `CadastroGate.tsx`    → manda pra tela de cadastro quem JÁ tem ficha
//                             completa (é o incidente de 05/08 se repetindo)
//
// Cada um foi escrito como "fail-closed, mais seguro". E é mesmo — para
// PERMISSÃO. Mas nenhum deles é permissão: são LEITURAS DE ESTADO, e nelas o
// fail-closed não protege nada, só mente. A pessoa não é impedida de nada; ela
// é informada errado, o que é pior, porque ela acredita.
//
// ⚠️ A distinção que importa: **"não consegui perguntar" ≠ "a resposta é não"**.
// Quem sabe a diferença é quem chamou — e o `lib/api.ts` já anexa `err.status`
// em todos os verbos, então dá pra distinguir sem tocar no backend.
// ============================================================================

/** Resultado de uma leitura que pode não ter acontecido. */
export type Leitura<T> =
  | { ok: true; valor: T }
  | { ok: false; motivo: MotivoFalha };

export type MotivoFalha =
  /** Sem internet / servidor fora / timeout. Tenta de novo depois. */
  | "conexao"
  /** Cota estourada (429). Some sozinho; NUNCA deve virar conteúdo. */
  | "limite"
  /** Sessão vencida (401/403). Aqui SIM o app deve reagir. */
  | "sessao"
  /** 5xx e o resto. */
  | "servidor";

/**
 * Classifica a falha a partir do erro que `lib/api.ts` lança.
 *
 * ⚠️ Sem status (erro de rede do `fetch`, timeout, DNS) ⇒ `"conexao"`. É o caso
 * mais comum no celular e o mais importante de NÃO confundir com resposta.
 */
export function motivoDaFalha(erro: unknown): MotivoFalha {
  const status = (erro as { status?: unknown } | null)?.status;
  const n = typeof status === "number" ? status : Number.NaN;
  if (!Number.isFinite(n)) return "conexao";
  if (n === 429) return "limite";
  if (n === 401 || n === 403) return "sessao";
  if (n >= 500) return "servidor";
  // 4xx que não é sessão nem cota: o servidor entendeu e recusou. Não é falha
  // de leitura — quem chamou trata como resposta.
  return "servidor";
}

/** Açúcar: embrulha uma promessa em `Leitura`, sem nunca lançar. */
export async function ler<T>(p: Promise<T>): Promise<Leitura<T>> {
  try {
    return { ok: true, valor: await p };
  } catch (e) {
    return { ok: false, motivo: motivoDaFalha(e) };
  }
}

/**
 * Esta falha pode virar CONTEÚDO na tela?
 *
 * ⚠️ SEMPRE `false`. A função existe para dar nome à regra e para que o `false`
 * apareça na busca do repo, não porque um dia poderá ser `true`: nenhuma falha
 * de leitura autoriza afirmar o contrário do que se queria ler. Se a tela
 * precisa mostrar ALGO, mostre "não foi possível carregar" com um toque pra
 * tentar de novo — nunca "você não está inscrito".
 */
export function podeVirarConteudo(_motivo: MotivoFalha): boolean {
  return false;
}
