export function destinoDevocionalKids(data: unknown) {
  const d = data && typeof data === 'object' ? data as Record<string, unknown> : {};
  const semana = typeof d.semana === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d.semana) ? d.semana : undefined;
  return { pathname: '/devocional-kids' as const, params: semana ? { semana } : {} };
}
