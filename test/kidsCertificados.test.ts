// KIDS › Certificados de Apresentação (17/11/2026): contrato com o ERP, URL só
// do bucket privado, destino do push, e baixar/compartilhar sem módulo novo.
import { beforeEach, describe, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({
  apiGet: vi.fn(), open: vi.fn(), openURL: vi.fn(), share: vi.fn(), available: vi.fn(),
  download: vi.fn(), pause: vi.fn(), remove: vi.fn(), mkdir: vi.fn(), readdir: vi.fn(), info: vi.fn(),
  read: vi.fn(), write: vi.fn(), pedir: vi.fn(), criar: vi.fn(), os: "android" as string,
}));
vi.mock("../lib/api", () => ({ apiGet: mock.apiGet }));
vi.mock("expo-web-browser", () => ({ openBrowserAsync: mock.open }));
vi.mock("react-native", () => ({ Platform: { get OS() { return mock.os; } }, Linking: { openURL: mock.openURL } }));
vi.mock("expo-sharing", () => ({ shareAsync: mock.share, isAvailableAsync: mock.available }));
vi.mock("expo-file-system/legacy", () => ({
  cacheDirectory: "file:///cache/",
  EncodingType: { Base64: "base64" },
  makeDirectoryAsync: mock.mkdir, deleteAsync: mock.remove, readDirectoryAsync: mock.readdir, getInfoAsync: mock.info,
  readAsStringAsync: mock.read, writeAsStringAsync: mock.write,
  StorageAccessFramework: { requestDirectoryPermissionsAsync: mock.pedir, createFileAsync: mock.criar },
  createDownloadResumable: (url: string, destino: string) => ({ downloadAsync: () => mock.download(url, destino), pauseAsync: mock.pause }),
}));
import {
  dataPorExtenso, destinoCertificadoKids, nomeDoArquivo, obterCertificadoUrl, ordenarComDestaque,
  salvarCertificado, compartilharCertificado, urlDeCertificadoValida, verCertificado, type CertificadoKids,
} from "../lib/kidsCertificados";

const ID = "00000000-0000-4000-8000-0000000000a1";
const URL_OK = `https://hhntwfawfnxvuobhdfkb.supabase.co/storage/v1/object/sign/kids-certificados/${ID}/abc.pdf?token=t`;
const cert: CertificadoKids = { id: ID, crianca_id: "c", crianca_nome: "Isabella Lazaro", data_apresentacao: "2026-10-12", liberado_em: "2026-11-17T10:00:00Z" };

beforeEach(() => {
  vi.clearAllMocks();
  mock.os = "android";
  mock.apiGet.mockResolvedValue({ url: URL_OK, nome: "x.pdf" });
  mock.available.mockResolvedValue(true);
  mock.readdir.mockResolvedValue([]);
  mock.mkdir.mockResolvedValue(undefined);
  mock.remove.mockResolvedValue(undefined);
  mock.share.mockResolvedValue(undefined);
  mock.download.mockImplementation(async (_u: string, destino: string) => ({ uri: destino, status: 200, headers: { "content-type": "application/pdf" } }));
  mock.read.mockResolvedValue("JVBERi0=");
  mock.write.mockResolvedValue(undefined);
  mock.criar.mockResolvedValue("content://pasta/certificado.pdf");
});

describe("régua", () => {
  it("URL: só https do projeto e do bucket privado do certificado", () => {
    expect(urlDeCertificadoValida(URL_OK)).toBe(true);
    expect(urlDeCertificadoValida(URL_OK.replace("https:", "http:"))).toBe(false);
    expect(urlDeCertificadoValida(URL_OK.replace("hhntwfawfnxvuobhdfkb", "outro"))).toBe(false);
    expect(urlDeCertificadoValida(URL_OK.replace("/sign/", "/public/"))).toBe(false);
    expect(urlDeCertificadoValida(URL_OK.replace("kids-certificados", "cartas-transferencia"))).toBe(false);
    expect(urlDeCertificadoValida("lixo")).toBe(false);
  });
  it("destino do push: id válido abre em destaque; qualquer outra coisa abre a lista", () => {
    expect(destinoCertificadoKids({ apresentacao_id: ID })).toEqual({ pathname: "/kids-certificados", params: { id: ID } });
    expect(destinoCertificadoKids({ apresentacao_id: "../../perfil" })).toEqual({ pathname: "/kids-certificados" });
    expect(destinoCertificadoKids({})).toEqual({ pathname: "/kids-certificados" });
  });
  it("data por extenso, nome do arquivo e destaque primeiro", () => {
    expect(dataPorExtenso("2026-10-12")).toBe("12 de outubro de 2026");
    expect(dataPorExtenso("lixo")).toBe("");
    expect(nomeDoArquivo(cert)).toBe("Certificado de apresentação - Isabella Lazaro.pdf");
    const outro = { ...cert, id: "b" };
    expect(ordenarComDestaque([outro, cert], ID).map((c) => c.id)).toEqual([ID, "b"]);
    expect(ordenarComDestaque([outro, cert], "nenhum").map((c) => c.id)).toEqual(["b", ID]);
  });
  it("API devolvendo URL fora do bucket é recusada", async () => {
    mock.apiGet.mockResolvedValue({ url: "https://evil.example/x.pdf" });
    await expect(obterCertificadoUrl(ID, "ver")).rejects.toThrow(/Não foi possível abrir o certificado/);
    expect(mock.apiGet).toHaveBeenCalledWith(`/app/kids/certificados/${ID}/pdf?modo=ver`);
  });
});

describe("ver, baixar e compartilhar", () => {
  it("ver abre o PDF no navegador do app (modo ver, sem download)", async () => {
    await verCertificado(cert);
    expect(mock.apiGet).toHaveBeenCalledWith(`/app/kids/certificados/${ID}/pdf?modo=ver`);
    expect(mock.open).toHaveBeenCalledWith(URL_OK, expect.anything());
  });
  it("compartilhar baixa no cache com o nome do certificado e abre a folha de PDF", async () => {
    await compartilharCertificado(cert);
    expect(mock.apiGet).toHaveBeenCalledWith(`/app/kids/certificados/${ID}/pdf?modo=baixar`);
    const [, destino] = mock.download.mock.calls[0];
    expect(destino).toMatch(/^file:\/\/\/cache\/certificado-\d+-[a-z0-9]+\/Certificado de apresentação - Isabella Lazaro\.pdf$/);
    expect(mock.share).toHaveBeenCalledWith(destino, expect.objectContaining({ mimeType: "application/pdf", UTI: "com.adobe.pdf" }));
    expect(mock.remove).not.toHaveBeenCalled();
  });
  it("download que não é PDF (URL vencida) dá erro e apaga a pasta", async () => {
    mock.download.mockResolvedValue({ uri: "file:///cache/x", status: 400, headers: { "content-type": "application/json" } });
    await expect(compartilharCertificado(cert)).rejects.toThrow(/baixar o certificado/);
    expect(mock.share).not.toHaveBeenCalled();
    expect(mock.remove).toHaveBeenCalled();
  });
  it("Android: baixar grava o PDF na pasta escolhida e apaga o cache", async () => {
    mock.pedir.mockResolvedValue({ granted: true, directoryUri: "content://pasta" });
    await expect(salvarCertificado(cert)).resolves.toBe("salvo");
    expect(mock.criar).toHaveBeenCalledWith("content://pasta", "Certificado de apresentação - Isabella Lazaro", "application/pdf");
    expect(mock.write).toHaveBeenCalledWith("content://pasta/certificado.pdf", "JVBERi0=", { encoding: "base64" });
    expect(mock.remove).toHaveBeenCalled();
    expect(mock.share).not.toHaveBeenCalled();
  });
  it("Android: quem cancela a escolha da pasta não baixa nada", async () => {
    mock.pedir.mockResolvedValue({ granted: false });
    await expect(salvarCertificado(cert)).resolves.toBe("cancelado");
    expect(mock.apiGet).not.toHaveBeenCalled();
    expect(mock.download).not.toHaveBeenCalled();
  });
  it("iOS: baixar abre a folha do sistema (que tem Salvar em Arquivos)", async () => {
    mock.os = "ios";
    await expect(salvarCertificado(cert)).resolves.toBe("folha");
    expect(mock.pedir).not.toHaveBeenCalled();
    expect(mock.share).toHaveBeenCalled();
  });
});
