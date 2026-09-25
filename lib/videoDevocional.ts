/**
 * Vídeo do devocional (25/09/2026). Régua PURA (no portão).
 *
 * O player é o <video> do HTML dentro do WebView — o único módulo de mídia que
 * já está no binário da loja (`react-native-webview`). `expo-video` seria
 * nativo: não sai por OTA.
 */

/** Só https e sem caractere que feche o atributo — a URL vai dentro do HTML. */
export function videoSeguro(url: string | null | undefined): string | null {
  if (typeof url !== "string") return null;
  const u = url.trim();
  if (!/^https:\/\/[^\s"'<>`]+$/i.test(u)) return null;
  return u;
}

/** Erro do PostgREST de coluna inexistente (migration ainda não aplicada). */
export function faltaColuna(error: unknown, coluna: string): boolean {
  const e = error as { code?: unknown; message?: unknown } | null;
  return !!e && e.code === "42703" && typeof e.message === "string" && e.message.includes(coluna);
}

/**
 * O id de 11 caracteres de um link do YouTube (watch, youtu.be, embed, shorts,
 * live). `null` quando não é YouTube.
 */
export function idDoYoutube(url: string | null | undefined): string | null {
  if (typeof url !== "string") return null;
  const m = url.trim().match(/^https?:\/\/(?:www\.|m\.)?(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/|youtube-nocookie\.com\/embed\/)([A-Za-z0-9_-]{11})(?:[?&#/].*)?$/i);
  return m ? m[1] : null;
}

/**
 * ⚠️⚠️ O YouTube recusa o player embutido sem ORIGEM ("Erro 153"): a página do
 * WebView é carregada com esta `baseUrl`, que vira o Referer do iframe.
 */
export const ORIGEM_DO_PLAYER = "https://cbrio.org";

/**
 * O player NUNCA leva a pessoa pra fora do app (pedido do Marcos: "ela clica
 * para ver mas não sai do app"). Navegação do FRAME PRINCIPAL só pra própria
 * página; o iframe do YouTube (isTopFrame === false) carrega à vontade. Tocar
 * no logo/título do YouTube tentaria abrir youtube.com no frame principal — e
 * é isso que fica barrado.
 */
export function navegacaoPermitida(url: string, isTopFrame: boolean | undefined): boolean {
  if (isTopFrame === false) return true;
  return url === "about:blank" || url.startsWith(ORIGEM_DO_PLAYER);
}

// Funções que o app chama por injectJavaScript, iguais nos dois players.
const PONTE = `function m(o){try{window.ReactNativeWebView.postMessage(JSON.stringify(o))}catch(e){}}`;

/** A página do player. `inicio` em segundos; `tocar` = autoplay (tela cheia). */
export function htmlDoVideo(url: string, opcoes: { inicio?: number; tocar?: boolean } = {}): string {
  const inicio = Math.max(0, Math.floor(opcoes.inicio ?? 0));
  const cabeca = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<style>html,body{margin:0;height:100%;background:#000;overflow:hidden}video,#p,iframe{width:100%;height:100%;border:0;background:#000}video{object-fit:contain}</style></head><body>`;
  const yt = idDoYoutube(url);
  if (yt) {
    return `${cabeca}<div id="p"></div><script>${PONTE}
var pl=null;window.pausar=function(){try{pl.pauseVideo()}catch(e){}};window.irPara=function(s){try{pl.seekTo(s,true)}catch(e){}};
function onYouTubeIframeAPIReady(){pl=new YT.Player('p',{videoId:'${yt}',width:'100%',height:'100%',
playerVars:{playsinline:1,rel:0,modestbranding:1,fs:1,start:${inicio},autoplay:${opcoes.tocar ? 1 : 0}},
events:{onReady:function(e){${opcoes.tocar ? "e.target.playVideo();" : ""}},onError:function(){m({erro:true})}}});
setInterval(function(){try{var t=pl.getCurrentTime();if(typeof t==='number')m({t:t})}catch(e){}},1000);}
</script><script src="https://www.youtube.com/iframe_api"></script></body></html>`;
  }
  const seguro = videoSeguro(url);
  if (!seguro) return "<!doctype html><html><body style=\"background:#000\"></body></html>";
  const src = inicio > 0 ? `${seguro}#t=${inicio}` : seguro;
  return `${cabeca}<video id="v" src="${src}" controls playsinline webkit-playsinline preload="metadata"${opcoes.tocar ? " autoplay" : ""}></video>
<script>(function(){${PONTE}var v=document.getElementById('v'),u=0;
window.pausar=function(){try{v.pause()}catch(e){}};window.irPara=function(s){try{v.currentTime=s}catch(e){}};
v.addEventListener('timeupdate',function(){var n=Date.now();if(n-u>900){u=n;m({t:v.currentTime})}});
v.addEventListener('pause',function(){m({t:v.currentTime})});
v.addEventListener('error',function(){m({erro:true})});})();</script></body></html>`;
}
