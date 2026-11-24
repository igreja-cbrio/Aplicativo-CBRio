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

import { IDADE_MINIMA_MS, ehSobraDaCamera, limparSobrasDaCamera } from "../lib/limparSobrasCamera";

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
    await expect(limparSobrasDaCamera(AGORA)).resolves.toBeUndefined();
    expect(fs.deleteAsync).toHaveBeenCalledTimes(1);
    expect(fs.deleteAsync).toHaveBeenCalledWith("file:///cache/ImagePicker/velha.jpg", { idempotent: true });
  });

  it("sem a pasta, sem cache ou com erro de leitura: não faz nada e não lança", async () => {
    fs.deleteAsync.mockClear();
    fs.getInfoAsync.mockResolvedValue({ exists: false });
    await expect(limparSobrasDaCamera(AGORA)).resolves.toBeUndefined();
    fs.getInfoAsync.mockRejectedValue(new Error("io"));
    await expect(limparSobrasDaCamera(AGORA)).resolves.toBeUndefined();
    fs.cacheDirectory = null;
    await expect(limparSobrasDaCamera(AGORA)).resolves.toBeUndefined();
    expect(fs.deleteAsync).not.toHaveBeenCalled();
  });
});
