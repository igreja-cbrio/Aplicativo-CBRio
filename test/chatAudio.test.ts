import { it, expect } from "vitest";
import { alturasOnda, htmlAudioChat, urlAnexoChat } from "@/lib/chatAudio";
const origem = "https://projeto.supabase.co";
const url = `${origem}/storage/v1/object/sign/wa-inbox-privado/app-chat/m/c/a.m4a?token=abc`;
it("só aceita anexo privado assinado na origem configurada", () => {
  expect(urlAnexoChat(url, origem)).toBe(url);
  for (const valor of [url.replace("projeto", "outro"), url.replace("https:", "http:"), url.replace("/sign/", "/public/"), url.split("?")[0], "javascript:alert(1)", `https://usuario@projeto.supabase.co${new URL(url).pathname}?token=x`]) expect(urlAnexoChat(valor, origem)).toBeNull();
  expect(urlAnexoChat(url, undefined)).toBeNull();
});
it("player não inicia sozinho nem carrega scripts externos e escapa conteúdo", () => {
  const html = htmlAudioChat(url + '&x="<script>', origem)!;
  expect(html).toContain("<audio playsinline");
  expect(html).not.toContain("autoplay");
  expect(html).not.toContain('<script src=');
  expect(html).toContain("default-src 'none'");
  expect(html).toContain("&amp;x=");
  expect(htmlAudioChat('https://externo.test/a.mp3', origem)).toBeNull();
});

it("onda é estável por mensagem: mesma mensagem, mesma onda; token novo não muda nada", () => {
  const a = htmlAudioChat(url, origem)!;
  const reassinado = htmlAudioChat(url.replace("token=abc", "token=xyz"), origem)!;
  expect(a.match(/<i style="height:[\d.]+px"><\/i>/g)).toHaveLength(30);
  expect(a.replace("token=abc", "token=xyz")).toBe(reassinado);
  expect(alturasOnda("/a.m4a")).toEqual(alturasOnda("/a.m4a"));
  expect(alturasOnda("/a.m4a")).not.toEqual(alturasOnda("/b.m4a"));
  for (const h of alturasOnda("/a.m4a")) { expect(h).toBeGreaterThanOrEqual(4); expect(h).toBeLessThanOrEqual(16); }
});

it("player acompanha reprodução, pausa, avanço pela onda e mostra o tempo real do áudio", async () => {
  const { runInNewContext } = await import("node:vm");
  const listeners: Record<string, Record<string, (e?: any) => void>> = {};
  const barras = Array.from({ length: 30 }, () => ({ tocada: false, classList: { toggle(_c: string, v: boolean) { (this as any).tocada = v; } } }));
  for (const [i, b] of barras.entries()) b.classList.toggle = b.classList.toggle.bind(barras[i]);
  const nodes: Record<string, any> = {
    audio: {
      addEventListener: (event: string, fn: () => void) => { (listeners.audio ||= {})[event] = fn; },
      paused: true, duration: NaN as number, currentTime: 0,
      play() { this.paused = false; listeners.audio.play(); return Promise.resolve(); },
      pause() { this.paused = true; listeners.audio.pause(); },
    },
    button: { addEventListener: (_e: string, fn: () => void) => { listeners.button = { click: fn }; }, classList: { toggle: () => {} }, setAttribute: () => {} },
    onda: {
      addEventListener: (_e: string, fn: (e: any) => void) => { listeners.onda = { click: fn }; },
      querySelectorAll: () => barras, setAttribute: () => {},
      getBoundingClientRect: () => ({ left: 0, width: 100 }),
    },
    tempo: { textContent: "" },
  };
  const doc = { hidden: false, querySelector: (s: string) => nodes[s.replace(/^[.#]/, "") === "audio" ? "audio" : s.replace(/^[.#]/, "") === "button" ? "button" : "onda"], getElementById: () => nodes.tempo, addEventListener: (event: string, fn: () => void) => { (listeners.document ||= {})[event] = fn; } };
  const html = htmlAudioChat(url, origem, true)!;
  runInNewContext(html.match(/<script>([\s\S]*)<\/script>/)![1], { document: doc, window: {}, Array });
  expect(html).toContain('class="tempo" id="tempo">--:--<');
  expect(nodes.audio.paused).toBe(true);
  nodes.audio.duration = 75;
  listeners.audio.loadedmetadata();
  expect(nodes.tempo.textContent).toBe("1:15");
  expect(barras.every(b => !b.tocada)).toBe(true);
  listeners.button.click();
  expect(nodes.audio.paused).toBe(false);
  listeners.onda.click({ clientX: 40 });
  expect(nodes.audio.currentTime).toBe(30);
  listeners.audio.timeupdate();
  expect(nodes.tempo.textContent).toBe("0:30");
  expect(barras.filter(b => b.tocada)).toHaveLength(12);
  doc.hidden = true;
  listeners.document.visibilitychange();
  expect(nodes.audio.paused).toBe(true);
});
