// Endereço publicado pela CBRio e exibido em Sobre. O destino usa rua e número,
// sem a busca genérica por “CBRio Barra da Tijuca”, que apontava para a praia.
export const ENDERECO_IGREJA = 'Av. das Américas, 7907 — Open Mall (subsolo), Barra da Tijuca, Rio de Janeiro';
export const DESTINO_IGREJA = 'Avenida das Américas, 7907, Barra da Tijuca, Rio de Janeiro, RJ, Brasil';
export type AplicativoMapa = 'mapas' | 'waze';

export function linksIgreja(plataforma: string) {
  const destino = encodeURIComponent(DESTINO_IGREJA);
  const google = `https://www.google.com/maps/dir/?api=1&destination=${destino}`;
  const apple = `https://maps.apple.com/?daddr=${destino}&dirflg=d`;
  return {
    mapas: plataforma === 'ios' ? apple : plataforma === 'android' ? `geo:0,0?q=${destino}` : google,
    fallback: plataforma === 'ios' ? apple : google,
    // Universal link: abre o aplicativo quando instalado e a página do Waze caso contrário.
    waze: `https://waze.com/ul?q=${destino}&navigate=yes&utm_source=cbrio`,
  };
}

export async function abrirMapaIgreja(app: AplicativoMapa, plataforma: string, abrir: (url: string) => Promise<unknown>) {
  const links = linksIgreja(plataforma);
  try { await abrir(links[app]); }
  catch (erro) {
    if (app === 'mapas' && links.mapas !== links.fallback) await abrir(links.fallback);
    else throw erro;
  }
}
