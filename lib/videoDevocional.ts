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

/** A página do player. `inicio` em segundos; `tocar` = autoplay (tela cheia). */
export function htmlDoVideo(url: string, opcoes: { inicio?: number; tocar?: boolean } = {}): string {
  const seguro = videoSeguro(url);
  if (!seguro) return "<!doctype html><html><body style=\"background:#000\"></body></html>";
  const inicio = Math.max(0, Math.floor(opcoes.inicio ?? 0));
  const src = inicio > 0 ? `${seguro}#t=${inicio}` : seguro;
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<style>html,body{margin:0;height:100%;background:#000}video{width:100%;height:100%;object-fit:contain;background:#000}</style></head>
<body><video id="v" src="${src}" controls playsinline webkit-playsinline preload="metadata"${opcoes.tocar ? " autoplay" : ""}></video>
<script>(function(){var v=document.getElementById('v'),u=0;function m(o){try{window.ReactNativeWebView.postMessage(JSON.stringify(o))}catch(e){}}
v.addEventListener('timeupdate',function(){var n=Date.now();if(n-u>900){u=n;m({t:v.currentTime})}});
v.addEventListener('pause',function(){m({t:v.currentTime})});
v.addEventListener('error',function(){m({erro:true})});})();</script></body></html>`;
}
