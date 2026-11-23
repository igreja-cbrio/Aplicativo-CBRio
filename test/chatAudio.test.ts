import { it, expect } from "vitest";
import { htmlAudioChat, urlAnexoChat } from "@/lib/chatAudio";
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

it("player acompanha reprodução, pausa e avanço com os dados reais do áudio", async () => {
  const { runInNewContext } = await import("node:vm");
  const listeners: Record<string, Record<string, () => void>> = {};
  const nodes = Object.fromEntries(['audio', 'button', 'input', 'elapsed', 'duration'].map(name => [name, {
    addEventListener: (event: string, fn: () => void) => { (listeners[name] ||= {})[event] = fn; },
    classList: { toggle: () => {} }, setAttribute: () => {}, textContent: '',
    paused: true, duration: 75, currentTime: 0, value: 0, max: 1, disabled: true,
    play() { this.paused = false; listeners.audio.play(); return Promise.resolve(); },
    pause() { this.paused = true; listeners.audio.pause(); },
  }]));
  const doc = { hidden: false, querySelector: (s: string) => nodes[s], getElementById: (s: string) => nodes[s], addEventListener: (event: string, fn: () => void) => { (listeners.document ||= {})[event] = fn; } };
  const html = htmlAudioChat(url, origem, true)!;
  runInNewContext(html.match(/<script>([\s\S]*)<\/script>/)![1], { document: doc, window: {} });
  expect(nodes.audio.paused).toBe(true);
  listeners.audio.loadedmetadata();
  expect(nodes.duration.textContent).toBe('1:15');
  expect(nodes.input.disabled).toBe(false);
  listeners.button.click();
  expect(nodes.audio.paused).toBe(false);
  nodes.input.value = 32;
  listeners.input.input();
  listeners.audio.timeupdate();
  expect(nodes.audio.currentTime).toBe(32);
  expect(nodes.elapsed.textContent).toBe('0:32');
  doc.hidden = true;
  listeners.document.visibilitychange();
  expect(nodes.audio.paused).toBe(true);
});
