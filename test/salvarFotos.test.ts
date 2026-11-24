// SALVAR FOTOS DO ÁLBUM · estratégia por binário/plataforma e o caminho de cada
// foto (24/11/2026). Nada nativo de verdade: galeria, sistema de arquivos e folha
// são injetados. O que se trava: permissão negada para TUDO; link pedido foto a
// foto; 401/403/410 renova o link UMA vez; arquivo que não é foto não passa;
// temporário sempre apagado; cancelar pausa o download e não vira "falhou";
// iPhone sem o módulo nunca começa lote.
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("react-native", () => ({ Platform: { OS: "ios" }, Share: { share: vi.fn(), dismissedAction: "dismissedAction" } }));
vi.mock("expo", () => ({ requireOptionalNativeModule: () => null }));
vi.mock("expo-file-system/legacy", () => ({}));
vi.mock("../lib/api", () => ({ apiGet: vi.fn() }));

import {
  CONCORRENCIA_POR_ESTRATEGIA,
  MENSAGENS,
  decidirTipoDaFoto,
  escolherEstrategia,
  nomeDaFoto,
  novoCancelamentoSalvar,
  pastaDoLote,
  salvarFotos,
  tipoPelosBytes,
  type DepsSalvar,
  type Galeria,
} from "../lib/salvarFotos";
import { mensagemDoResumo } from "../lib/filaFotos";

const JPEG = "/9j/4AAQSkZJRgABAQAAAQ=="; // FF D8 FF E0 …
const PNG = "iVBORw0KGgoAAAANSUhEUg==";
const HTML = "PCFET0NUWVBFIGh0bWw+PGh0"; // "<!DOCTYPE html><h"
const LINK = (id: string) => `https://cbrio.sharepoint.com/_layouts/15/download.aspx?UniqueId=${id}&tempauth=segredo`;

type Resposta = { status: number; headers?: Record<string, string> } | null;
type Foto = { id: string; nome: string; tamanho: number | null };
const fotos = (n: number): Foto[] => Array.from({ length: n }, (_, i) => ({ id: `f${i + 1}`, nome: `IMG_${i + 1}.JPG`, tamanho: 1000 }));

function criarFs(responder: (url: string) => Resposta | Promise<Resposta>, cabecaBase64 = JPEG, log: string[] = []) {
  const apagados: string[] = [];
  const criadas: string[] = [];
  const pausas = { n: 0 };
  let ativos = 0;
  let pico = 0;
  const fs = {
    cacheDirectory: "file:///cache/",
    EncodingType: { Base64: "base64", UTF8: "utf8" },
    makeDirectoryAsync: vi.fn(async (u: string) => {
      criadas.push(u);
    }),
    deleteAsync: vi.fn(async (u: string) => {
      apagados.push(u);
    }),
    readDirectoryAsync: vi.fn(async () => [] as string[]),
    getInfoAsync: vi.fn(async () => ({ exists: false })),
    moveAsync: vi.fn(async () => {}),
    readAsStringAsync: vi.fn(async (_u: string, o?: { length?: number }) => (o?.length ? cabecaBase64 : "QUJD")),
    writeAsStringAsync: vi.fn(async () => {}),
    createDownloadResumable: vi.fn((url: string, destino: string) => ({
      downloadAsync: async () => {
        log.push(`download:${url.split("UniqueId=")[1]?.split("&")[0]}`);
        ativos += 1;
        pico = Math.max(pico, ativos);
        try {
          const r = await responder(url);
          return r ? { uri: destino, status: r.status, headers: r.headers ?? { "Content-Type": "image/jpeg" } } : undefined;
        } finally {
          ativos -= 1;
        }
      },
      pauseAsync: async () => {
        pausas.n += 1;
      },
    })),
    StorageAccessFramework: {
      requestDirectoryPermissionsAsync: vi.fn(async () => ({ granted: true, directoryUri: "content://pasta" })),
      createFileAsync: vi.fn(async (dir: string, nome: string, mime: string) => `${dir}/${nome}|${mime}`),
    },
  };
  return { fs, log, apagados, criadas, pausas, pico: () => pico };
}

function galeria(granted = true): Galeria & { salvos: string[] } {
  const salvos: string[] = [];
  return {
    salvos,
    requestPermissionsAsync: vi.fn(async () => ({ granted, canAskAgain: granted })),
    saveToLibraryAsync: vi.fn(async (uri: string) => {
      salvos.push(uri);
    }),
  };
}

function deps(over: Omit<Partial<DepsSalvar>, "fs"> & { fs: unknown }): DepsSalvar {
  return {
    plataforma: "ios",
    galeria: () => null,
    compartilhar: vi.fn(async () => "compartilhado" as const),
    ...over,
    fs: over.fs as DepsSalvar["fs"],
  };
}

const obterLink = (log?: string[]) =>
  vi.fn(async (f: Foto) => {
    log?.push(`link:${f.id}`);
    return { url: LINK(f.id) };
  });

describe("estratégia por plataforma e binário", () => {
  it("binário novo (com o módulo) usa a galeria nas duas plataformas", () => {
    expect(escolherEstrategia({ plataforma: "ios", temGaleria: true, quantidade: 30 })).toBe("galeria");
    expect(escolherEstrategia({ plataforma: "android", temGaleria: true, quantidade: 1 })).toBe("galeria");
  });
  it("Android sem o módulo grava numa pasta escolhida", () => {
    expect(escolherEstrategia({ plataforma: "android", temGaleria: false, quantidade: 30 })).toBe("pasta");
  });
  it("iPhone sem o módulo: uma foto pela folha; várias pede atualizar o app", () => {
    expect(escolherEstrategia({ plataforma: "ios", temGaleria: false, quantidade: 1 })).toBe("folha");
    expect(escolherEstrategia({ plataforma: "ios", temGaleria: false, quantidade: 2 })).toBe("atualizar_app");
  });
  it("web/outra: indisponível", () => {
    expect(escolherEstrategia({ plataforma: "outra", temGaleria: true, quantidade: 1 })).toBe("indisponivel");
  });
  it("concorrência: 2 na galeria, 1 na pasta (base64 em memória) e na folha", () => {
    expect(CONCORRENCIA_POR_ESTRATEGIA).toEqual({ galeria: 2, pasta: 1, folha: 1 });
  });
});

describe("o que baixou é foto?", () => {
  it("reconhece JPEG e PNG pelos primeiros bytes", () => {
    expect(tipoPelosBytes(JPEG)).toBe("jpg");
    expect(tipoPelosBytes(PNG)).toBe("png");
    expect(tipoPelosBytes(HTML)).toBeNull();
  });
  it("image/* vale; octet-stream só com bytes de imagem; HTML nunca", () => {
    expect(decidirTipoDaFoto("image/jpeg; charset=binary", JPEG)).toEqual({ ext: "jpg" });
    expect(decidirTipoDaFoto("image/heic", "")).toEqual({ ext: "heic" });
    expect(decidirTipoDaFoto("application/octet-stream", JPEG)).toEqual({ ext: "jpg" });
    expect(decidirTipoDaFoto("application/octet-stream", HTML)).toEqual({ erro: true });
    expect(decidirTipoDaFoto("text/html", JPEG)).toEqual({ erro: true });
    expect(decidirTipoDaFoto(null, HTML)).toEqual({ erro: true });
  });
  it("nome seguro com a extensão do tipo real", () => {
    expect(nomeDaFoto("IMG_1.JPG", "jpg")).toBe("IMG_1.jpg");
    expect(nomeDaFoto("../../a:b?.png", "jpg")).toBe(".. .. a b.jpg");
    expect(nomeDaFoto("", "png")).toBe("foto-batismo.png");
  });
  it("limpeza de sobras só toca no PRÓPRIO prefixo", () => {
    expect(pastaDoLote("batismofotos-1732460000000-ab12cd")).toBe(true);
    expect(pastaDoLote("carta-1732460000000-ab12cd")).toBe(false);
    expect(pastaDoLote("batismofotos")).toBe(false);
  });
});

describe("galeria (binário novo)", () => {
  it("pede SÓ a permissão de adicionar e salva cada foto, no máximo 2 baixando juntas", async () => {
    const f = criarFs(async () => {
      await new Promise((r) => setTimeout(r, 2));
      return { status: 200 };
    });
    const g = galeria(true);
    const r = await salvarFotos(fotos(6), { obterLink: obterLink() }, deps({ plataforma: "android", galeria: () => g, fs: f.fs }));
    expect(g.requestPermissionsAsync).toHaveBeenCalledWith(true, ["photo"]);
    expect(r.tipo).toBe("fila");
    if (r.tipo !== "fila") return;
    expect(r.estrategia).toBe("galeria");
    expect(r.resumo.situacao).toBe("concluido");
    expect(g.salvos).toHaveLength(6);
    expect(g.salvos.every((u) => u.endsWith(".jpg"))).toBe(true);
    expect(f.pico()).toBe(2);
    expect(mensagemDoResumo(r.resumo)).toBe("6 fotos salvas.");
  });

  it("⚠️ permissão negada para TUDO: nenhum link pedido, nenhum byte baixado", async () => {
    const f = criarFs(() => ({ status: 200 }));
    const link = obterLink();
    const r = await salvarFotos(fotos(3), { obterLink: link }, deps({ galeria: () => galeria(false), fs: f.fs }));
    expect(r).toEqual({ tipo: "sem_permissao", podePerguntarDeNovo: false });
    expect(link).not.toHaveBeenCalled();
    expect(f.fs.createDownloadResumable).not.toHaveBeenCalled();
  });

  it("401/403/410 do SharePoint: pede link novo UMA vez", async () => {
    let n = 0;
    const f = criarFs(() => ({ status: n++ === 0 ? 403 : 200 }));
    const g = galeria(true);
    const link = obterLink();
    const r = await salvarFotos(fotos(1), { obterLink: link }, deps({ galeria: () => g, fs: f.fs }));
    expect(link).toHaveBeenCalledTimes(2);
    expect(r.tipo === "fila" && r.resumo.salvas).toBe(1);

    const sempre410 = criarFs(() => ({ status: 410 }));
    const link2 = obterLink();
    const r2 = await salvarFotos(fotos(1), { obterLink: link2 }, deps({ galeria: () => galeria(true), fs: sempre410.fs }));
    expect(link2).toHaveBeenCalledTimes(2);
    expect(r2.tipo === "fila" && r2.resumo.falhou[0].erro).toBe(MENSAGENS.download);
  });

  it("⚠️ falha parcial não vira sucesso; temporário apagado; URL nunca na mensagem", async () => {
    const f = criarFs((url) => (url.includes("f2") ? { status: 200, headers: { "content-type": "text/html" } } : { status: 200 }), JPEG);
    const g = galeria(true);
    const r = await salvarFotos(fotos(3), { obterLink: obterLink() }, deps({ galeria: () => g, fs: f.fs }));
    if (r.tipo !== "fila") throw new Error("esperava fila");
    expect(r.resumo.salvas).toBe(2);
    expect(r.resumo.falhou.map((x) => [x.item.id, x.erro])).toEqual([["f2", MENSAGENS.formato]]);
    expect(r.resumo.situacao).toBe("parcial");
    expect(JSON.stringify(r.resumo.falhou)).not.toContain("sharepoint");
    // Cada pasta de foto que foi criada foi apagada, e o lote também.
    const pastasDeFoto = f.criadas.filter((u) => /\/\d+\/$/.test(u));
    expect(pastasDeFoto).toHaveLength(3);
    for (const p of pastasDeFoto) expect(f.apagados).toContain(p);
    expect(f.apagados.some((u) => /batismofotos-\d+-[a-z0-9]+\/$/.test(u))).toBe(true);
  });

  it("link fora do SharePoint é recusado sem baixar", async () => {
    const f = criarFs(() => ({ status: 200 }));
    const r = await salvarFotos(
      fotos(1),
      { obterLink: async () => ({ url: "https://evil.example/x.jpg" }) },
      deps({ galeria: () => galeria(true), fs: f.fs }),
    );
    expect(f.fs.createDownloadResumable).not.toHaveBeenCalled();
    expect(r.tipo === "fila" && r.resumo.falhou[0].erro).toBe(MENSAGENS.link);
  });

  it("⚠️ cancelar pausa o download em andamento e conta como CANCELADA, não como falha", async () => {
    const f = criarFs(() => ({ status: 200 }));
    // Download que só termina quando é PAUSADO (o nativo devolve undefined nesse caso).
    f.fs.createDownloadResumable.mockImplementation(() => {
      let liberar: () => void = () => {};
      return {
        downloadAsync: () => new Promise<undefined>((r) => (liberar = () => r(undefined))),
        pauseAsync: async () => {
          f.pausas.n += 1;
          liberar();
        },
      } as never;
    });
    const c = novoCancelamentoSalvar();
    const promessa = salvarFotos(fotos(5), { obterLink: obterLink(), cancelamento: c }, deps({ galeria: () => galeria(true), fs: f.fs }));
    await new Promise((r) => setTimeout(r, 5));
    c.cancelar();
    const r = await promessa;
    expect(f.pausas.n).toBeGreaterThan(0);
    if (r.tipo !== "fila") throw new Error("esperava fila");
    expect(r.resumo.falhas).toBe(0);
    expect(r.resumo.salvas).toBe(0);
    expect(r.resumo.canceladas).toBe(5);
    expect(mensagemDoResumo(r.resumo)).toBe("0 de 5 fotos salvas · 5 canceladas.");
  });
});

describe("Android sem o módulo · pasta escolhida", () => {
  it("link pedido imediatamente antes de cada download (nunca todos adiantados)", async () => {
    const log: string[] = [];
    const f = criarFs(() => ({ status: 200 }), JPEG, log);
    await salvarFotos(fotos(3), { obterLink: obterLink(log) }, deps({ plataforma: "android", fs: f.fs }));
    // Pasta = 1 por vez: a ordem é estrita.
    expect(log).toEqual(["link:f1", "download:f1", "link:f2", "download:f2", "link:f3", "download:f3"]);
  });

  it("fechar o seletor de pasta é desistir (resumo cancelado), não erro", async () => {
    const f = criarFs(() => ({ status: 200 }));
    f.fs.StorageAccessFramework.requestDirectoryPermissionsAsync.mockResolvedValue({ granted: false } as never);
    const link = obterLink();
    const r = await salvarFotos(fotos(4), { obterLink: link }, deps({ plataforma: "android", fs: f.fs }));
    if (r.tipo !== "fila") throw new Error("esperava fila");
    expect(r.resumo).toMatchObject({ salvas: 0, falhas: 0, canceladas: 4, cancelado: true, situacao: "nada" });
    expect(link).not.toHaveBeenCalled();
  });

  it("pede a pasta UMA vez e grava cada foto nela, com o tipo certo", async () => {
    const f = criarFs(() => ({ status: 200, headers: { "Content-Type": "application/octet-stream" } }), PNG);
    const r = await salvarFotos(fotos(2), { obterLink: obterLink() }, deps({ plataforma: "android", fs: f.fs }));
    expect(f.fs.StorageAccessFramework.requestDirectoryPermissionsAsync).toHaveBeenCalledTimes(1);
    expect(f.fs.StorageAccessFramework.createFileAsync.mock.calls).toEqual([
      ["content://pasta", "IMG_1", "image/png"],
      ["content://pasta", "IMG_2", "image/png"],
    ]);
    expect(f.fs.writeAsStringAsync).toHaveBeenCalledTimes(2);
    expect(r.tipo === "fila" && r.resumo.situacao).toBe("concluido");
  });
});

describe("iPhone sem o módulo · folha do sistema", () => {
  it("uma foto: baixa e abre a folha; o arquivo é apagado depois", async () => {
    const f = criarFs(() => ({ status: 200 }));
    const compartilhar = vi.fn(async (_uri: string) => "dispensado" as const);
    const r = await salvarFotos(fotos(1), { obterLink: obterLink() }, deps({ plataforma: "ios", fs: f.fs, compartilhar }));
    expect(compartilhar).toHaveBeenCalledTimes(1);
    expect(compartilhar.mock.calls[0][0]).toMatch(/\/IMG_1\.jpg$/);
    expect(r).toMatchObject({ tipo: "fila", estrategia: "folha", folhaDispensada: true });
    expect(f.apagados.some((u) => /\/1\/$/.test(u))).toBe(true);
  });

  it("várias fotos: não começa (pede atualizar o app) e não baixa nada", async () => {
    const f = criarFs(() => ({ status: 200 }));
    const link = obterLink();
    const r = await salvarFotos(fotos(3), { obterLink: link }, deps({ plataforma: "ios", fs: f.fs }));
    expect(r).toEqual({ tipo: "precisa_atualizar" });
    expect(link).not.toHaveBeenCalled();
    expect(f.fs.createDownloadResumable).not.toHaveBeenCalled();
  });

  it("web: indisponível", async () => {
    const f = criarFs(() => ({ status: 200 }));
    expect(await salvarFotos(fotos(1), { obterLink: obterLink() }, deps({ plataforma: "outra", fs: f.fs }))).toEqual({ tipo: "indisponivel" });
  });
});
