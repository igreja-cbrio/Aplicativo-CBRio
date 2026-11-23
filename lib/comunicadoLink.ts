const ROTAS = ['/inscricao-batismo', '/next', '/grupos', '/kids', '/inscricoes'];
export function destinoComunicado(valor: unknown): { tipo: 'app' | 'web'; url: string } | null {
  if (typeof valor !== 'string' || valor.length > 2048) return null;
  const s = valor.trim();
  if (ROTAS.includes(s)) return { tipo: 'app', url: s };
  try {
    const url = new URL(s);
    if (url.protocol === 'https:' && !url.username && !url.password && !/[\u0000-\u0020]/.test(s)) return { tipo: 'web', url: url.href };
  } catch { /* link inválido não abre */ }
  return null;
}
