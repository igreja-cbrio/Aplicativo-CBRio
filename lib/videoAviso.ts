import { videoSeguro } from "./videoDevocional";

const escapar = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function htmlVideoAviso(uri: string, titulo: string, reproduzir: string): string {
  const url = videoSeguro(uri);
  if (!url) return "";
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>html,body{margin:0;height:100%;overflow:hidden;background:#000}video{display:block;width:100%;height:100%;object-fit:contain;background:#000}button{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);border:1px solid #fff;border-radius:28px;padding:14px 22px;background:#222;color:#fff;font:600 16px system-ui}button[hidden]{display:none}</style></head>
<body><video id="v" data-src="${escapar(url)}" controls playsinline webkit-playsinline preload="auto" aria-label="${escapar(titulo)}"></video><button id="play" type="button">&#9654; ${escapar(reproduzir)}</button>
<script>(function(){
var v=document.getElementById('v'),b=document.getElementById('play'),timer;
function enviar(m){window.ReactNativeWebView.postMessage(JSON.stringify(m))}
function pronto(){clearTimeout(timer);enviar({tipo:'pronto'})}
function falhou(){clearTimeout(timer);b.hidden=false;enviar({tipo:'erro'})}
function esperar(){clearTimeout(timer);enviar({tipo:'carregando'});timer=setTimeout(falhou,20000)}
v.addEventListener('loadedmetadata',function(){enviar({tipo:'dimensoes',largura:v.videoWidth,altura:v.videoHeight})});
v.addEventListener('loadeddata',pronto);
v.addEventListener('canplay',pronto);
v.addEventListener('playing',function(){b.hidden=true;pronto()});
v.addEventListener('waiting',esperar);
v.addEventListener('error',falhou);
v.addEventListener('ended',function(){b.hidden=false;pronto()});
b.addEventListener('click',function(){esperar();try{var p=v.play();if(p&&p.catch)p.catch(falhou)}catch(e){falhou()}});
window.pausar=function(){v.pause()};
document.addEventListener('visibilitychange',function(){if(document.hidden)v.pause()});
esperar();v.src=v.getAttribute('data-src');
})();</script></body></html>`;
}

export function proporcaoVideoAviso(largura: unknown, altura: unknown): number | null {
  if (typeof largura !== "number" || typeof altura !== "number" || !Number.isFinite(largura) || !Number.isFinite(altura) || largura <= 0 || altura <= 0) return null;
  return Math.max(0.4, Math.min(2.5, largura / altura));
}
