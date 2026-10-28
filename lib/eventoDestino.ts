/** URLs públicas da CBRio; nunca encaminhar a sessão autenticada para a página. */
export function urlPublicaCbrio(valor: string): string | null {
  try {
    const u = new URL(valor);
    return u.protocol === "https:" && !u.username && !u.password && !u.port
      && ["cbrio.org", "www.cbrio.org"].includes(u.hostname) ? u.href : null;
  } catch { return null; }
}

export function urlFormularioEvento(valor: string): string | null {
  const url = urlPublicaCbrio(valor);
  if (url) return /^\/evento\/[^/]+\/?$/.test(new URL(url).pathname) ? url : null;
  return /^[a-zA-Z0-9_-]+$/.test(valor) ? `https://www.cbrio.org/evento/${valor}` : null;
}

/** Push novo tem ID; o legado só tem slug. Ambos ficam dentro do app. */
export function destinoNotificacaoEvento(data: { evento_id?: unknown; slug?: unknown }) {
  if (typeof data.evento_id === "string" && data.evento_id.trim()) {
    return { pathname: "/evento" as const, params: { id: data.evento_id } };
  }
  if (typeof data.slug === "string" && /^[a-zA-Z0-9_-]+$/.test(data.slug)) {
    return { pathname: "/evento" as const, params: { slug: data.slug } };
  }
  return "/inscricoes" as const;
}

export function eventoCorresponde(evento: { id: string; slug: string }, id?: string, slug?: string) {
  return id ? evento.id === id : !!slug && evento.slug === slug;
}

/** Terceiros usam a porta pública, que resolve o participante pelos dados
 * preenchidos. A API autenticada de inscrição vincula o titular da conta. */
export function destinoInscricaoOutraPessoa(url?: string | null) {
  const segura = typeof url === "string" ? urlPublicaCbrio(url) : null;
  return segura ? { pathname: "/inscricao-formulario" as const, params: { url: segura, para: "outra-pessoa" } } : null;
}
