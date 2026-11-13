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
  expect(html).toContain("controls playsinline");
  expect(html).not.toContain("autoplay");
  expect(html).not.toContain('<script src=');
  expect(html).toContain("default-src 'none'");
  expect(html).toContain("&amp;x=");
  expect(htmlAudioChat('https://externo.test/a.mp3', origem)).toBeNull();
});
