/**
 * Vídeo de fundo da faixa de topo do login. Régua PURA (no portão).
 *
 * O player é o <video> do HTML dentro do WebView (`react-native-webview`, que
 * já está no binário da loja). `expo-video`/`expo-av` seriam módulos nativos
 * ausentes nos binários antigos: um OTA que os importasse quebraria o app.
 */

export const LOGIN_VIDEO_URL = "https://cbrio.com.br/novosite/hero.mp4";

/** Mensagem que o HTML posta quando o vídeo de fato começou a tocar. */
export const LOGIN_VIDEO_PLAYING = "playing";

/**
 * HTML do player: mudo, autoplay, loop, playsinline, `object-fit: cover`,
 * fundo transparente (o pôster nativo fica por baixo). Sem controles.
 */
export function htmlLoginVideo(src: string = LOGIN_VIDEO_URL): string {
  return `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<style>
html,body{margin:0;padding:0;width:100%;height:100%;background:transparent;overflow:hidden}
video{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;background:transparent;pointer-events:none}
</style></head><body>
<video id="v" src="${src}" muted autoplay loop playsinline webkit-playsinline preload="auto" disablepictureinpicture></video>
<script>
(function(){
  var v=document.getElementById('v');
  v.muted=true;
  function post(m){try{window.ReactNativeWebView.postMessage(m)}catch(e){}}
  v.addEventListener('playing',function(){post('${LOGIN_VIDEO_PLAYING}')});
  var p=v.play(); if(p&&p.catch)p.catch(function(){});
})();
</script></body></html>`;
}
