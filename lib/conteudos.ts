// ============================================================================
// Módulo Conteúdos (21/10/2026) — régua PURA (no portão).
//
// Catálogo de vídeos do Vimeo da igreja: avulsos e pastas com partes, vindos
// de GET /api/app/conteudos (quem decide o que está publicado é o ERP). Aqui
// vive o que o CI consegue provar: busca/filtro/ordem e o HTML do player.
//
// ⚠️⚠️ A conta Vimeo restringe incorporação por DOMÍNIO (medido 21/10/2026):
// o player responde 403 sem Referer e toca com Referer de cbrio.com.br/www/
// app. — e BLOQUEIA cbrio.org, a origem do player do Devocional. Por isso o
// WebView daqui carrega com `baseUrl: ORIGEM_VIMEO` (vira o Referer do
// iframe, provado em WebKit com as três origens) e a regra de navegação é
// própria, parametrizada — reusar a do Devocional daria tela preta.
// ============================================================================

export type ConteudoVideo = {
  tipo: "video";
  id: string;
  vimeo_id: string;
  vimeo_hash: string | null;
  titulo: string;
  descricao: string | null;
  categoria_id: string | null;
  thumbnail_url: string | null;
  duracao_seg: number | null;
  data_conteudo: string | null;
  publicado_em: string | null;
  destaque: boolean;
};

export type ConteudoPasta = {
  tipo: "pasta";
  id: string;
  titulo: string;
  descricao: string | null;
  categoria_id: string | null;
  capa_url: string | null;
  data_conteudo: string | null;
  publicado_em: string | null;
  destaque: boolean;
  partes: ConteudoVideo[];
};

export type ConteudoItem = ConteudoVideo | ConteudoPasta;
export type Catalogo = {
  categorias: { id: string; nome: string }[];
  itens: ConteudoItem[];
  total_videos: number;
};

/** A origem que o Vimeo aceita — baseUrl do WebView do player. */
export const ORIGEM_VIMEO = "https://www.cbrio.com.br";

import { casaBusca } from "@/lib/buscaTexto";

/**
 * Busca, filtro de categoria e ordenação do catálogo.
 * - Busca casa no título do item e, em pasta, também no título das PARTES
 *   (quem procura "Deuteronômio" acha o curso que contém a aula).
 * - Ordem por data_conteudo (quando o conteúdo foi gravado); sem data vai
 *   pro fim nas DUAS ordens. Desempate por título.
 * - `destaque` NÃO fura a ordem: a faixa "Em destaque" é da tela.
 */
export function filtrarCatalogo(
  itens: ConteudoItem[],
  o: { termo?: string; categoriaId?: string | null; ordem: "recentes" | "antigos" },
): ConteudoItem[] {
  const filtrados = itens.filter((i) => {
    if (o.categoriaId && i.categoria_id !== o.categoriaId) return false;
    if (!o.termo) return true;
    if (casaBusca(i.titulo, o.termo)) return true;
    return i.tipo === "pasta" && i.partes.some((p) => casaBusca(p.titulo, o.termo));
  });
  const dir = o.ordem === "antigos" ? 1 : -1;
  return [...filtrados].sort((a, b) => {
    if (!a.data_conteudo && !b.data_conteudo) return a.titulo.localeCompare(b.titulo);
    if (!a.data_conteudo) return 1; // sem data vai pro fim, em qualquer ordem
    if (!b.data_conteudo) return -1;
    return a.data_conteudo === b.data_conteudo
      ? a.titulo.localeCompare(b.titulo)
      : dir * a.data_conteudo.localeCompare(b.data_conteudo);
  });
}

/**
 * A página do player do Vimeo, carregada com `baseUrl: ORIGEM_VIMEO`.
 * - `<meta referrer>` + `referrerpolicy` fixos: não depender do padrão do SO.
 * - id só dígitos e hash só [A-Za-z0-9]: fora do formato, página preta — os
 *   valores entram no HTML e isso é o que impede injeção.
 * - player.js posta `play`/`ended`/`erro` pro app (telemetria; base do
 *   "continuar de onde parou" futuro).
 */
export function htmlDoVimeo(id: string, hash: string | null, o: { tocar?: boolean } = {}): string {
  const idSeguro = /^\d{6,12}$/.test(String(id)) ? String(id) : null;
  const hashSeguro = hash && /^[A-Za-z0-9]{1,64}$/.test(hash) ? hash : null;
  if (!idSeguro) return '<!doctype html><html><body style="background:#000"></body></html>';
  const q = [hashSeguro ? `h=${hashSeguro}` : null, "playsinline=1", "dnt=1", o.tocar ? "autoplay=1" : null]
    .filter(Boolean)
    .join("&");
  return `<!doctype html><html><head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<meta name="referrer" content="origin">
<style>html,body{margin:0;height:100%;background:#000;overflow:hidden}iframe{width:100%;height:100%;border:0;background:#000}</style>
<script src="https://player.vimeo.com/api/player.js"></script>
</head><body>
<iframe id="f" src="https://player.vimeo.com/video/${idSeguro}?${q}" referrerpolicy="origin" allow="autoplay; fullscreen; encrypted-media; picture-in-picture" allowfullscreen></iframe>
<script>(function(){function m(o){try{window.ReactNativeWebView.postMessage(JSON.stringify(o))}catch(e){}}
try{var p=new Vimeo.Player(document.getElementById('f'));
p.on('play',function(){m({evento:'play'})});
p.on('ended',function(){m({evento:'ended'})});
p.ready().catch(function(){m({evento:'erro'})});}catch(e){m({evento:'erro'})}})();</script>
</body></html>`;
}

/**
 * Navegação do player: o frame principal nunca sai da própria página (tocar
 * no logo do Vimeo não abre o site); os subframes (o player em si) carregam
 * à vontade.
 */
export function navegacaoVimeoPermitida(url: string, isTopFrame: boolean | undefined): boolean {
  if (isTopFrame === false) return true;
  // ⚠️ Prefixo cru não basta: "https://www.cbrio.com.br.evil.tld" começa com
  // a origem. Ou é a origem exata, ou um caminho DENTRO dela (barra depois).
  return url === "about:blank" || url === ORIGEM_VIMEO || url.startsWith(`${ORIGEM_VIMEO}/`);
}
