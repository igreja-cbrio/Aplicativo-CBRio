// Destino fechado: nenhum redirect arbitrário vindo do link.
export function tokenSupervisor(valor: unknown): string | null {
  return typeof valor === 'string' && /^[a-f0-9]{64}$/.test(valor) ? valor : null;
}
export function destinoSupervisor(valor: unknown): string | null {
  const token = tokenSupervisor(valor);
  return token ? `/voluntariado?convite=${token}` : null;
}
export function conviteDaUrl(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.protocol !== 'cbrio:' || u.hostname !== 'voluntariado' || !['','/'].includes(u.pathname)) return null;
    return tokenSupervisor(u.searchParams.get('convite'));
  } catch { return null; }
}
