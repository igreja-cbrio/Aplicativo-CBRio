import { beforeEach, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({
  api: vi.fn(),
  share: vi.fn(),
  available: vi.fn(),
  download: vi.fn(),
  pause: vi.fn(),
  remove: vi.fn(),
  mkdir: vi.fn(),
  readdir: vi.fn(),
  info: vi.fn(),
}));
vi.mock("../lib/cartaTransferencia", () => ({ obterCartaPdf: mock.api }));
vi.mock("react-native", () => ({
  Platform: { OS: "android" },
  Linking: { openURL: vi.fn() },
}));
vi.mock("expo-sharing", () => ({
  shareAsync: mock.share,
  isAvailableAsync: mock.available,
}));
vi.mock("expo-file-system/legacy", () => ({
  cacheDirectory: "file:///cache/",
  makeDirectoryAsync: mock.mkdir,
  deleteAsync: mock.remove,
  readDirectoryAsync: mock.readdir,
  getInfoAsync: mock.info,
  createDownloadResumable: () => ({
    downloadAsync: mock.download,
    pauseAsync: mock.pause,
  }),
}));
import { compartilharCartaPdf } from "../lib/cartaPdf";
beforeEach(() => {
  vi.clearAllMocks();
  mock.api.mockResolvedValue({ url: "https://assinado" });
  mock.available.mockResolvedValue(true);
  mock.readdir.mockResolvedValue([]);
  mock.mkdir.mockResolvedValue(undefined);
  mock.remove.mockResolvedValue(undefined);
  mock.share.mockResolvedValue(undefined);
  mock.download.mockResolvedValue({
    uri: "file:///cache/carta.pdf",
    status: 200,
    headers: { "Content-Type": "application/pdf" },
  });
});
it("compartilha o PDF e preserva o arquivo após chooser retornar", async () => {
  await compartilharCartaPdf("p");
  expect(mock.api).toHaveBeenCalledWith("p");
  expect(mock.share).toHaveBeenCalledWith(
    "file:///cache/carta.pdf",
    expect.objectContaining({
      mimeType: "application/pdf",
      UTI: "com.adobe.pdf",
    }),
  );
  expect(mock.remove).not.toHaveBeenCalled();
});
it("não compartilha erro HTML; limpa arquivo parcial", async () => {
  mock.download.mockResolvedValueOnce({
    uri: "file:///erro",
    status: 403,
    headers: { "content-type": "text/html" },
  });
  await expect(compartilharCartaPdf("p")).rejects.toThrow(
    "Não foi possível baixar",
  );
  expect(mock.share).not.toHaveBeenCalled();
  expect(mock.remove).toHaveBeenCalled();
});
it("limpa apenas PDFs temporários antigos, preservando cache de outros módulos e arquivos recentes", async () => {
  mock.readdir.mockResolvedValue(["carta-123-abc", "carta-456-def", "avatar"]);
  mock.info.mockImplementation((p: string) =>
    Promise.resolve({
      exists: true,
      modificationTime: p.includes("123") ? 1 : Date.now() / 1000,
    }),
  );
  await compartilharCartaPdf("p");
  expect(mock.remove).toHaveBeenCalledTimes(1);
  expect(mock.remove).toHaveBeenCalledWith("file:///cache/carta-123-abc", {
    idempotent: true,
  });
});
