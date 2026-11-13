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
export function htmlAudioChat(url: string, origem: string | undefined): string | null {
  const segura = urlAnexoChat(url, origem);
  if (!segura) return null;
  const host = new URL(segura).origin;
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; media-src ${host}; style-src 'unsafe-inline'; script-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><style>html,body{margin:0;padding:0;background:transparent}audio{width:100%;height:54px}</style></head><body><audio controls playsinline preload="metadata" controlslist="nodownload noremoteplayback" src="${escapar(segura)}"></audio><script>document.querySelector('audio').addEventListener('error',function(){window.ReactNativeWebView.postMessage('audio-error')});</script></body></html>`;
}
