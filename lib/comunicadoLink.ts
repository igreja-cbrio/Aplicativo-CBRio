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

/** Ambos os sinos passam pela leitura autorizada, inclusive testes antigos só com ID. */
export function destinoNotificacaoComunicado(data: Record<string, unknown>) {
  const id = typeof data.comunicado_id === 'string' ? data.comunicado_id : '';
  return id
    ? { pathname: '/mural' as const, params: { comunicado_id: id, abrir_inscricao: '1' } }
    : '/mural' as const;
}

export function inscricaoDoComunicado(id: string | undefined, itens: { id: string; link_inscricao?: string | null }[]) {
  return destinoComunicado(itens.find((item) => item.id === id)?.link_inscricao);
}
