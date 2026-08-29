// ============================================================================
// "Suas respostas" da inscrição · chave técnica NUNCA vai pra tela
//
// Relato do Matheus (29/08/2026): o cartão mostrava `area_serve` no lugar de
// "Em qual ministério você serve?". A chave é identificador do form-builder —
// ela existe pra amarrar resposta à pergunta (e é PRESERVADA byte a byte, lei
// de 03/08), não pra ser lida por gente.
//
// ⚠️ O rótulo vem de `evento.campos`, que é a MESMA fonte que desenhou o
// formulário. Sem isso a tela inventaria um texto que não é a pergunta feita.
// ============================================================================
export type CampoRotulo = { key: string; label?: string };

/** Rótulo da pergunta. Sem campo correspondente, humaniza a chave em vez de
 *  mostrá-la crua — pergunta apagada do formulário não pode virar `area_serve`
 *  na tela, e some-la esconderia uma resposta que a pessoa deu. */
export function rotuloResposta(chave: string, campos?: CampoRotulo[] | null): string {
  const c = (campos || []).find((x) => x && x.key === chave);
  const label = c && typeof c.label === "string" ? c.label.trim() : "";
  if (label) return label;
  const humano = String(chave || "").replace(/[_-]+/g, " ").trim();
  if (!humano) return "";
  return humano.charAt(0).toUpperCase() + humano.slice(1);
}

/** Valor legível. Múltipla escolha vira "A, B"; booleano vira Sim/Não. */
export function valorResposta(valor: unknown): string {
  if (valor === null || valor === undefined) return "";
  if (typeof valor === "boolean") return valor ? "Sim" : "Não";
  if (Array.isArray(valor)) {
    return valor.map((v) => valorResposta(v)).filter(Boolean).join(", ");
  }
  if (typeof valor === "object") {
    // Objeto não tem forma conhecida aqui — despejar JSON na tela é pior que
    // omitir; a resposta continua no ERP, que é onde alguém investiga.
    return "";
  }
  return String(valor).trim();
}

/** As respostas prontas pra desenhar, já sem as vazias. */
export function respostasParaExibir(
  respostas?: Record<string, unknown> | null,
  campos?: CampoRotulo[] | null,
): { chave: string; rotulo: string; valor: string }[] {
  const out: { chave: string; rotulo: string; valor: string }[] = [];
  for (const [chave, bruto] of Object.entries(respostas || {})) {
    const valor = valorResposta(bruto);
    if (!valor) continue;            // resposta em branco não vira linha vazia
    const rotulo = rotuloResposta(chave, campos);
    if (!rotulo) continue;
    out.push({ chave, rotulo, valor });
  }
  // Segue a ORDEM do formulário quando ela é conhecida — a pessoa respondeu
  // nessa sequência, e reordenar por acaso do objeto confunde a conferência.
  const ordem = new Map((campos || []).map((c, i) => [c.key, i]));
  return out.sort((a, b) => {
    const ia = ordem.has(a.chave) ? (ordem.get(a.chave) as number) : 1e6;
    const ib = ordem.has(b.chave) ? (ordem.get(b.chave) as number) : 1e6;
    return ia - ib || a.rotulo.localeCompare(b.rotulo);
  });
}
