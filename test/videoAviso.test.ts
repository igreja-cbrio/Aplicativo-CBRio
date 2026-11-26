import { describe, expect, it, vi } from "vitest";
import { runInNewContext } from "node:vm";
import { htmlVideoAviso, proporcaoVideoAviso } from "../lib/videoAviso";

const uri = "https://storage.example/video.mp4?token=abc&x=1";
function player(rejeitar = false) {
  const eventos: Record<string, () => void> = {};
  const mensagens: any[] = [];
  let clique = () => {};
  let timeout = () => {};
  const video = { videoWidth: 464, videoHeight: 832, src: "", getAttribute: () => uri,
    addEventListener: (nome: string, fn: () => void) => { eventos[nome] = fn; },
    play: vi.fn(() => rejeitar ? Promise.reject(new Error("Falha")) : Promise.resolve()), pause: vi.fn() };
  const botao = { hidden: false, addEventListener: (_: string, fn: () => void) => { clique = fn; } };
  const window = { ReactNativeWebView: { postMessage: (s: string) => mensagens.push(JSON.parse(s)) }, pausar: () => {} };
  const script = htmlVideoAviso(uri, "Aviso", "Reproduzir").match(/<script>([\s\S]*?)<\/script>/)![1];
  runInNewContext(script, { window, document: { getElementById: (id: string) => id === "v" ? video : botao, addEventListener: vi.fn() },
    setTimeout: (fn: () => void) => { timeout = fn; }, clearTimeout: vi.fn() });
  return { video, botao, mensagens, eventos, clique: () => clique(), timeout: () => timeout(), window };
}

describe("vídeo de aviso", () => {
  it("preserva a URL assinada e só inicia reprodução no toque", async () => {
    const p = player();
    expect(p.video.src).toBe(uri);
    expect(p.video.play).not.toHaveBeenCalled();
    p.clique();
    expect(p.video.play).toHaveBeenCalledOnce();
    p.eventos.playing();
    expect(p.botao.hidden).toBe(true);
    expect(p.mensagens.at(-1)).toEqual({ tipo: "pronto" });
  });
  it("não confunde carregar o HTML com carregar o vídeo", () => {
    const p = player();
    expect(p.mensagens).toEqual([{ tipo: "carregando" }]);
    p.eventos.loadedmetadata();
    expect(p.mensagens.at(-1)).toEqual({ tipo: "dimensoes", largura: 464, altura: 832 });
    p.eventos.loadeddata();
    expect(p.mensagens.at(-1)).toEqual({ tipo: "pronto" });
  });
  it("revela erro em falha de mídia, bloqueio do play e espera sem resposta", async () => {
    const p = player(true);
    p.clique();
    await Promise.resolve();
    expect(p.mensagens.at(-1)).toEqual({ tipo: "erro" });
    p.eventos.error();
    expect(p.mensagens.at(-1)).toEqual({ tipo: "erro" });
    p.eventos.waiting();
    p.timeout();
    expect(p.mensagens.at(-1)).toEqual({ tipo: "erro" });
    expect(p.botao.hidden).toBe(false);
  });
  it("pausa ao sair e permite reproduzir de novo ao terminar", () => {
    const p = player(); p.window.pausar();
    expect(p.video.pause).toHaveBeenCalledOnce();
    p.eventos.playing(); p.eventos.ended();
    expect(p.botao.hidden).toBe(false);
  });
  it("escapa título e URL sem permitir HTML ou scripts externos", () => {
    const html = htmlVideoAviso(uri, '</video><script>alert("x")</script>', 'Play');
    expect(html).toContain('token=abc&amp;x=1');
    expect(html).not.toContain('<script>alert(');
    expect(htmlVideoAviso('javascript:alert(1)', 'Aviso', 'Play')).toBe('');
  });
  it("respeita as dimensões reais, ignorando metadados inválidos", () => {
    expect(proporcaoVideoAviso(464, 832)).toBe(464 / 832);
    expect(proporcaoVideoAviso(1920, 1080)).toBe(16 / 9);
    expect(proporcaoVideoAviso(0, 832)).toBeNull();
    expect(proporcaoVideoAviso(464, Infinity)).toBeNull();
  });
});
