export function urlAnexoChat(valor: unknown, origem: string | undefined): string | null {
  try {
    if (typeof valor !== "string" || !origem) return null;
    const url = new URL(valor), base = new URL(origem);
    return base.protocol === "https:" && url.origin === base.origin && !url.username && !url.password
      && url.pathname.startsWith("/storage/v1/object/sign/wa-inbox-privado/app-chat/")
      && !!url.searchParams.get("token") ? url.href : null;
  } catch { return null; }
}

// Onda do player: a MESMA mensagem mostra sempre a MESMA onda (a referência
// visual sorteava alturas com Math.random e a onda mudava a cada render).
// Semente = PATH do arquivo: a URL assinada é re-emitida com token novo, mas
// o arquivo (e a onda) não muda. FNV-1a + xorshift32, determinístico.
function hashSemente(semente: string): number {
  let h = 2166136261;
  for (let i = 0; i < semente.length; i++) { h ^= semente.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
export function alturasOnda(semente: string, barras = 30, min = 4, variacao = 12): number[] {
  let estado = hashSemente(semente) || 1;
  const alturas: number[] = [];
  for (let i = 0; i < barras; i++) {
    estado ^= estado << 13; estado >>>= 0;
    estado ^= estado >> 17;
    estado ^= estado << 5; estado >>>= 0;
    alturas.push(min + ((estado % 1000) / 1000) * variacao);
  }
  return alturas;
}

const escapar = (s: string) => s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
export function htmlAudioChat(url: string, origem: string | undefined, meu = false, tinta?: string): string | null {
  const segura = urlAnexoChat(url, origem);
  if (!segura) return null;
  const host = new URL(segura).origin;
  // Tinta padrão histórica; quem chama (AnexoChatEquipe) passa a cor do tema
  // (colors.text), senão no modo escuro a onda ficava apagada na bolha.
  tinta = tinta || (meu ? "#ffffff" : "#536575");
  const barras = alturasOnda(new URL(segura).pathname)
    .map(h => `<i style="height:${h.toFixed(1)}px"></i>`).join("");
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; media-src ${host}; style-src 'unsafe-inline'; script-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><style>
  *{box-sizing:border-box}html,body{margin:0;padding:0;background:transparent;color:${tinta};font:12px -apple-system,system-ui,sans-serif}
  .player{display:flex;align-items:center;gap:12px;height:64px}button{border:1.5px solid currentColor;border-radius:9999px;background:transparent;color:inherit;width:40px;height:40px;padding:0;flex-shrink:0;display:grid;place-items:center;cursor:pointer}button svg{width:18px;height:18px;fill:currentColor}.pause{display:none}.playing .play{display:none}.playing .pause{display:block}.onda{flex:1;min-width:0;height:28px;display:flex;align-items:center;justify-content:space-between;padding:0 1px;cursor:pointer}.onda i{display:block;width:3px;border-radius:2px;background:currentColor;opacity:.35}.onda i.tocada{opacity:1}.tempo{flex-shrink:0;min-width:34px;text-align:right;opacity:.85;font-variant-numeric:tabular-nums}button:focus-visible,.onda:focus-visible{outline:2px solid currentColor;outline-offset:1px;border-radius:6px}
  </style></head><body><div class="player"><button type="button" aria-label="Reproduzir áudio"><svg class="play" viewBox="0 0 24 24"><path d="M7 4.5v15l12-7.5z"/></svg><svg class="pause" viewBox="0 0 24 24"><path d="M6 5h4v14H6zm8 0h4v14h-4z"/></svg></button><div class="onda" role="slider" aria-label="Progresso do áudio" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" tabindex="0">${barras}</div><span class="tempo" id="tempo">--:--</span></div><audio playsinline preload="metadata" controlslist="nodownload noremoteplayback" src="${escapar(segura)}"></audio><script>
  const audio=document.querySelector('audio'),button=document.querySelector('button'),onda=document.querySelector('.onda'),barras=Array.prototype.slice.call(onda.querySelectorAll('i')),tempo=document.getElementById('tempo');
  const time=n=>Number.isFinite(n)?Math.floor(n/60)+':'+String(Math.floor(n%60)).padStart(2,'0'):'--:--';
  const pintar=()=>{const d=audio.duration,p=Number.isFinite(d)&&d>0?audio.currentTime/d:0;barras.forEach((b,i)=>b.classList.toggle('tocada',(i+0.5)/barras.length<=p));onda.setAttribute('aria-valuenow',String(Math.round(p*100)));tempo.textContent=time(audio.currentTime>0.05?audio.currentTime:d);button.classList.toggle('playing',!audio.paused);button.setAttribute('aria-label',audio.paused?'Reproduzir áudio':'Pausar áudio');};
  const fail=()=>{window.ReactNativeWebView?.postMessage('audio-error');};
  button.addEventListener('click',()=>{if(audio.paused){audio.play().catch(fail);}else{audio.pause();}});
  onda.addEventListener('click',e=>{const r=onda.getBoundingClientRect();if(Number.isFinite(audio.duration)&&audio.duration>0&&r.width>0){audio.currentTime=Math.min(1,Math.max(0,(e.clientX-r.left)/r.width))*audio.duration;}});
  onda.addEventListener('keydown',e=>{if(!Number.isFinite(audio.duration)||audio.duration<=0)return;if(e.key==='ArrowRight'||e.key==='ArrowLeft'){const passo=e.key==='ArrowRight'?5:-5;audio.currentTime=Math.min(audio.duration,Math.max(0,audio.currentTime+passo));e.preventDefault();}else if(e.key==='Home'){audio.currentTime=0;e.preventDefault();}else if(e.key==='End'){audio.currentTime=audio.duration;e.preventDefault();}});
  ['loadedmetadata','durationchange','timeupdate','play','pause','ended'].forEach(event=>audio.addEventListener(event,pintar));
  audio.addEventListener('error',fail);document.addEventListener('visibilitychange',()=>{if(document.hidden)audio.pause();});
  </script></body></html>`;
}
