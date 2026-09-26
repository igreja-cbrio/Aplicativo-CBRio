// Seleção de conteúdo do membro. Não concede acesso de funcionário nem altera o cadastro-base.
let generation = 0;
let owner: string | null = null;
let campus: string | null = null;
const pending = new Set<AbortController>();
export function setCampusSession(userId: string | null, campusId: string | null) {
  owner = userId; campus = campusId; generation += 1;
  pending.forEach(controller => controller.abort()); pending.clear();
  return generation;
}
export function captureCampusSession() {
  const captured = generation;
  const controller = new AbortController();
  pending.add(controller);
  return {
    userId: owner, campusId: campus, generation: captured,
    cacheKey: `${owner || 'anon'}:${campus || 'sem-campus'}`,
    signal: controller.signal,
    assertCurrent() {
      if (captured !== generation || controller.signal.aborted) throw Object.assign(new Error('O campus mudou. Carregue os dados novamente.'), { code: 'CAMPUS_CONTEXT_CHANGED' });
    },
    release() { pending.delete(controller); },
  };
}
