import { describe, expect, it } from "vitest";
import { executarFila, FotoCancelada, mensagemDoResumo, novoCancelamento } from "../lib/filaFotos";
import { TRANSLATIONS } from "../lib/translations";

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe("filaFotos · baixar várias fotos", () => {
  it("nunca passa do teto de downloads simultâneos", async () => {
    let agora = 0;
    let pico = 0;
    const r = await executarFila(
      Array.from({ length: 12 }, (_, i) => i),
      async () => {
        agora += 1;
        pico = Math.max(pico, agora);
        await esperar(2);
        agora -= 1;
      },
      { concorrencia: 2 },
    );
    expect(pico).toBe(2);
    expect(r.salvas).toBe(12);
    expect(r.situacao).toBe("concluido");
  });

  it("concorrência pedida acima do máximo é limitada a 3", async () => {
    let agora = 0;
    let pico = 0;
    await executarFila(
      Array.from({ length: 20 }, (_, i) => i),
      async () => {
        agora += 1;
        pico = Math.max(pico, agora);
        await esperar(1);
        agora -= 1;
      },
      { concorrencia: 50 },
    );
    expect(pico).toBe(3);
  });

  it("falha parcial não vira sucesso e diz qual falhou", async () => {
    const r = await executarFila([1, 2, 3, 4], async (n) => {
      if (n % 2 === 0) throw new Error(`erro ${n}`);
    });
    expect(r.salvas).toBe(2);
    expect(r.falhas).toBe(2);
    expect(r.falhou.map((f) => f.item).sort()).toEqual([2, 4]);
    expect(r.situacao).toBe("parcial");
    expect(mensagemDoResumo(r)).toBe("2 de 4 fotos salvas · 2 falharam.");
  });

  it("cancelar impede que itens novos comecem", async () => {
    const c = novoCancelamento();
    const comecados: number[] = [];
    const r = await executarFila(
      Array.from({ length: 10 }, (_, i) => i),
      async (n) => {
        comecados.push(n);
        if (n === 1) c.cancelar();
        await esperar(1);
      },
      { concorrencia: 2, cancelamento: c },
    );
    expect(comecados.length).toBe(2);
    expect(r.cancelado).toBe(true);
    expect(r.canceladas).toBe(8);
    expect(r.situacao).toBe("parcial");
    expect(mensagemDoResumo(r)).toBe("2 de 10 fotos salvas · 8 canceladas.");
  });

  it("todas falharam: situação nada", async () => {
    const r = await executarFila([1], async () => {
      throw new Error("sem rede");
    });
    expect(r.situacao).toBe("nada");
    expect(r.falhou[0].erro).toBe("sem rede");
    expect(mensagemDoResumo(r)).toBe("0 de 1 foto salva · 1 falhou.");
  });

  it("progresso chega ao fim com o total certo", async () => {
    const vistos: number[] = [];
    await executarFila([1, 2, 3], async () => {}, { aoProgredir: (p) => vistos.push(p.salvas + p.falhas) });
    expect(vistos[vistos.length - 1]).toBe(3);
  });

  it("mensagem de sucesso só quando todas salvaram", () => {
    expect(mensagemDoResumo({ total: 1, salvas: 1, falhas: 0, canceladas: 0, cancelado: false })).toBe("Foto salva.");
    expect(mensagemDoResumo({ total: 5, salvas: 5, falhas: 0, canceladas: 0, cancelado: false })).toBe("5 fotos salvas.");
  });

  // 24/11: o download pausado pelo Cancelar lança FotoCancelada. "1 falhou" para
  // a foto que a própria pessoa interrompeu seria mentira no resumo.
  it("foto interrompida pelo cancelamento conta como cancelada, não como falha", async () => {
    const c = novoCancelamento();
    const r = await executarFila(
      [1, 2, 3],
      async (n) => {
        if (n === 1) {
          c.cancelar();
          throw new FotoCancelada();
        }
      },
      { concorrencia: 1, cancelamento: c },
    );
    expect(r).toMatchObject({ salvas: 0, falhas: 0, canceladas: 3, situacao: "nada", cancelado: true });
    expect(r.falhou).toEqual([]);
  });

  it("o resumo sai traduzido pedaço a pedaço, e toda chave usada existe no dicionário", () => {
    const usadas = new Set<string>();
    const tr = (pt: string) => {
      usadas.add(pt);
      return TRANSLATIONS[pt]?.en ?? `«${pt}»`;
    };
    expect(mensagemDoResumo({ total: 4, salvas: 2, falhas: 1, canceladas: 1, cancelado: true }, tr)).toBe(
      "2 of 4 photos saved · 1 failed · 1 canceled.",
    );
    expect(mensagemDoResumo({ total: 1, salvas: 1, falhas: 0, canceladas: 0, cancelado: false }, tr)).toBe("Photo saved.");
    for (const r of [
      { total: 0, salvas: 0, falhas: 0, canceladas: 0, cancelado: false },
      { total: 3, salvas: 3, falhas: 0, canceladas: 0, cancelado: false },
      { total: 3, salvas: 0, falhas: 2, canceladas: 1, cancelado: false },
      { total: 2, salvas: 1, falhas: 0, canceladas: 1, cancelado: true },
    ])
      mensagemDoResumo(r, tr);
    for (const k of usadas) expect(TRANSLATIONS[k], `sem tradução: ${k}`).toBeTruthy();
  });
});
