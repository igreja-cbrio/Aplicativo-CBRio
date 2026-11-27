// Sobras da câmera no cache (busca por selfie · 24/11/2026). Ver lib/limparSobrasCamera.ts.
import { describe, expect, it, vi } from "vitest";

vi.mock("react-native", () => ({ Platform: { OS: "android" } }));
const fs = vi.hoisted(() => ({
  cacheDirectory: "file:///cache/" as string | null,
  getInfoAsync: vi.fn(),
  readDirectoryAsync: vi.fn(),
  deleteAsync: vi.fn(),
}));
vi.mock("expo-file-system/legacy", () => fs);

import { IDADE_MINIMA_MS, ehSobraDaCamera, limparSobrasDaCamera, limparSobrasNaAbertura } from "../lib/limparSobrasCamera";

const AGORA = Date.UTC(2026, 10, 24, 20, 0, 0);
const s = (ms: number) => ms / 1000;

describe("régua da sobra", () => {
  it("só apaga arquivo com nome normal e mais velho que a janela", () => {
    expect(ehSobraDaCamera("abc-123.jpg", s(AGORA - IDADE_MINIMA_MS), AGORA)).toBe(true);
    expect(ehSobraDaCamera("abc-123.jpg", s(AGORA - IDADE_MINIMA_MS + 1000), AGORA)).toBe(false);
    expect(ehSobraDaCamera("abc-123.jpg", undefined, AGORA)).toBe(false);
    expect(ehSobraDaCamera("abc-123.jpg", 0, AGORA)).toBe(false);
    expect(ehSobraDaCamera("../x.jpg", s(AGORA - 10 * IDADE_MINIMA_MS), AGORA)).toBe(false);
    expect(ehSobraDaCamera("..", s(AGORA - 10 * IDADE_MINIMA_MS), AGORA)).toBe(false);
    expect(ehSobraDaCamera(42, s(AGORA - 10 * IDADE_MINIMA_MS), AGORA)).toBe(false);
  });

  it("janela 0 (abertura do app) apaga qualquer arquivo; janela = desde a abertura da busca apaga só o anterior a ela", () => {
    expect(ehSobraDaCamera("a.jpg", s(AGORA - 1000), AGORA, 0)).toBe(true);
    expect(ehSobraDaCamera("a.jpg", s(AGORA), AGORA, 0)).toBe(true);
    const abertaEm = AGORA - 5 * 60_000;
    expect(ehSobraDaCamera("sobra.jpg", s(abertaEm - 2 * 60_000), AGORA, AGORA - abertaEm)).toBe(true);
    expect(ehSobraDaCamera("desta-busca.jpg", s(abertaEm + 60_000), AGORA, AGORA - abertaEm)).toBe(false);
  });
});

describe("limpeza", () => {
  it("apaga só as sobras da pasta do picker e nunca lança", async () => {
    fs.getInfoAsync.mockImplementation(async (uri: string) => {
      if (uri === "file:///cache/ImagePicker/") return { exists: true, isDirectory: true };
      if (uri.endsWith("velha.jpg")) return { exists: true, isDirectory: false, modificationTime: s(AGORA - 2 * IDADE_MINIMA_MS) };
      if (uri.endsWith("nova.jpg")) return { exists: true, isDirectory: false, modificationTime: s(AGORA - 60_000) };
      if (uri.endsWith("falha.jpg")) throw new Error("io");
      return { exists: false };
    });
    fs.readDirectoryAsync.mockResolvedValue(["velha.jpg", "nova.jpg", "falha.jpg"]);
    fs.deleteAsync.mockResolvedValue(undefined);
    await expect(limparSobrasDaCamera({ agoraMs: AGORA })).resolves.toBeUndefined();
    expect(fs.deleteAsync).toHaveBeenCalledTimes(1);
    expect(fs.deleteAsync).toHaveBeenCalledWith("file:///cache/ImagePicker/velha.jpg", { idempotent: true });
  });

  it("sem a pasta, sem cache ou com erro de leitura: não faz nada e não lança", async () => {
    fs.deleteAsync.mockClear();
    fs.getInfoAsync.mockResolvedValue({ exists: false });
    await expect(limparSobrasDaCamera({ agoraMs: AGORA })).resolves.toBeUndefined();
    fs.getInfoAsync.mockRejectedValue(new Error("io"));
    await expect(limparSobrasDaCamera({ agoraMs: AGORA })).resolves.toBeUndefined();
    fs.cacheDirectory = null;
    await expect(limparSobrasDaCamera({ agoraMs: AGORA })).resolves.toBeUndefined();
    expect(fs.deleteAsync).not.toHaveBeenCalled();
  });
});

describe("abertura do app", () => {
  it("apaga tudo da pasta do picker, uma vez só por início do JS", async () => {
    fs.cacheDirectory = "file:///cache/";
    fs.deleteAsync.mockClear();
    fs.getInfoAsync.mockReset();
    fs.getInfoAsync.mockImplementation(async (uri: string) =>
      uri === "file:///cache/ImagePicker/"
        ? { exists: true, isDirectory: true }
        : { exists: true, isDirectory: false, modificationTime: Date.now() / 1000 - 5 },
    );
    fs.readDirectoryAsync.mockResolvedValue(["selfie.jpg"]);
    limparSobrasNaAbertura();
    limparSobrasNaAbertura();
    await vi.waitFor(() => expect(fs.deleteAsync).toHaveBeenCalledTimes(1));
    expect(fs.deleteAsync).toHaveBeenCalledWith("file:///cache/ImagePicker/selfie.jpg", { idempotent: true });
    expect(fs.readDirectoryAsync).toHaveBeenCalledTimes(1);
  });
});

describe('câmera embutida', () => {
  it('também apaga sobras em Camera/, mesmo se ImagePicker estiver inacessível', async () => {
    fs.cacheDirectory = 'file:///cache/';
    fs.deleteAsync.mockClear();
    fs.getInfoAsync.mockImplementation(async (uri: string) => {
      if (uri.includes('ImagePicker')) throw new Error('io');
      if (uri === 'file:///cache/Camera/') return {exists:true,isDirectory:true};
      return {exists:true,isDirectory:false,modificationTime:s(uri.endsWith('nova.jpg') ? AGORA - 1000 : AGORA - 2*IDADE_MINIMA_MS)};
    });
    fs.readDirectoryAsync.mockResolvedValue(['velha.jpg','nova.jpg']);
    await limparSobrasDaCamera({agoraMs:AGORA});
    expect(fs.deleteAsync).toHaveBeenCalledExactlyOnceWith('file:///cache/Camera/velha.jpg',{idempotent:true});
  });
});
