export function urlAnexoChat(valor: unknown, origem: string | undefined): string | null {
  try {
    if (typeof valor !== "string" || !origem) return null;
    const url = new URL(valor), base = new URL(origem);
    return base.protocol === "https:" && url.origin === base.origin && !url.username && !url.password
      && url.pathname.startsWith("/storage/v1/object/sign/wa-inbox-privado/app-chat/")
      && !!url.searchParams.get("token") ? url.href : null;
  } catch { return null; }
}
const escapar = (s: string) => s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
export function htmlAudioChat(url: string, origem: string | undefined, meu = false): string | null {
  const segura = urlAnexoChat(url, origem);
  if (!segura) return null;
  const host = new URL(segura).origin;
  const tinta = meu ? "#ffffff" : "#536575";
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; media-src ${host}; style-src 'unsafe-inline'; script-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><style>
  *{box-sizing:border-box}html,body{margin:0;padding:0;background:transparent;color:${tinta};font:12px -apple-system,system-ui,sans-serif}
  .player{display:flex;align-items:center;gap:12px;height:64px}button{border:0;background:transparent;color:inherit;width:44px;height:44px;padding:10px;flex-shrink:0;display:grid;place-items:center}button svg{width:24px;height:24px;fill:currentColor}.pause{display:none}.playing .play{display:none}.playing .pause{display:block}.timeline{flex:1;min-width:0}input{display:block;width:100%;height:32px;margin:0;accent-color:${tinta};cursor:pointer}input:disabled{opacity:.5}.time{display:flex;justify-content:space-between;opacity:.8;font-variant-numeric:tabular-nums;padding:0 2px}button:focus-visible,input:focus-visible{outline:2px solid currentColor;outline-offset:1px;border-radius:6px}
  </style></head><body><div class="player"><button type="button" aria-label="Reproduzir áudio"><svg class="play" viewBox="0 0 24 24"><path d="M7 4.5v15l12-7.5z"/></svg><svg class="pause" viewBox="0 0 24 24"><path d="M6 5h4v14H6zm8 0h4v14h-4z"/></svg></button><div class="timeline"><input type="range" aria-label="Progresso do áudio" min="0" max="1" step="0.1" value="0" disabled><div class="time"><span id="elapsed">0:00</span><span id="duration">--:--</span></div></div></div><audio playsinline preload="metadata" controlslist="nodownload noremoteplayback" src="${escapar(segura)}"></audio><script>
  const audio=document.querySelector('audio'),button=document.querySelector('button'),seek=document.querySelector('input');
  const time=n=>Number.isFinite(n)?Math.floor(n/60)+':'+String(Math.floor(n%60)).padStart(2,'0'):'--:--';
  const update=()=>{const valid=Number.isFinite(audio.duration)&&audio.duration>0;seek.disabled=!valid;seek.max=valid?audio.duration:1;seek.value=audio.currentTime||0;document.getElementById('elapsed').textContent=time(audio.currentTime);document.getElementById('duration').textContent=time(audio.duration);button.classList.toggle('playing',!audio.paused);button.setAttribute('aria-label',audio.paused?'Reproduzir áudio':'Pausar áudio');};
  const fail=()=>{window.ReactNativeWebView?.postMessage('audio-error');};
  button.addEventListener('click',()=>{if(audio.paused){audio.play().catch(fail);}else{audio.pause();}});
  seek.addEventListener('input',()=>{if(Number.isFinite(audio.duration))audio.currentTime=Number(seek.value);});
  ['loadedmetadata','durationchange','timeupdate','play','pause','ended'].forEach(event=>audio.addEventListener(event,update));
  audio.addEventListener('error',fail);document.addEventListener('visibilitychange',()=>{if(document.hidden)audio.pause();});
  </script></body></html>`;
}
