import { describe, expect, it } from "vitest";
import { diasDoPlano, semanasDoPlano, semanaEmFoco } from "@/lib/planoRitmo";
import { faltaColuna, htmlDoVideo, videoSeguro } from "@/lib/videoDevocional";

const itens = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `i${i + 1}`, ordem_no_ciclo: i + 1, data: "2000-01-01" }));
const lidosAte = (n: number) => Array.from({ length: n }, (_, i) => `i${i + 1}`);

describe("semanas do plano longo", () => {
  it("plano de até 7 dias não ganha semanas (o Valores de Cristo tem 5)", () => {
    expect(semanasDoPlano(diasDoPlano(itens(5), []))).toEqual([]);
    expect(semanasDoPlano(diasDoPlano(itens(7), []))).toEqual([]);
  });
  it("32 dias = 5 semanas, a última com 4", () => {
    const s = semanasDoPlano(diasDoPlano(itens(32), []));
    expect(s.map((x) => x.dias.length)).toEqual([7, 7, 7, 7, 4]);
    expect(s[1].dias[0].numero).toBe(8);
  });
  it("abre na 1ª semana não completa: fechar a semana 1 leva pra 2", () => {
    expect(semanaEmFoco(semanasDoPlano(diasDoPlano(itens(20), lidosAte(6))))).toBe(1);
    expect(semanaEmFoco(semanasDoPlano(diasDoPlano(itens(20), lidosAte(7))))).toBe(2);
  });
  it("tudo lido fica na última semana, nunca numa que não existe", () => {
    expect(semanaEmFoco(semanasDoPlano(diasDoPlano(itens(15), lidosAte(15))))).toBe(3);
    expect(semanaEmFoco([])).toBe(1);
  });
});

describe("vídeo do devocional", () => {
  it("só aceita https sem aspas (a URL vai dentro do HTML)", () => {
    expect(videoSeguro("https://x.supabase.co/v.mp4")).toBe("https://x.supabase.co/v.mp4");
    expect(videoSeguro("http://x/v.mp4")).toBeNull();
    expect(videoSeguro('https://x/v.mp4" onerror="alert(1)')).toBeNull();
    expect(videoSeguro(null)).toBeNull();
  });
  it("o HTML leva o início e o autoplay só na tela cheia", () => {
    expect(htmlDoVideo("https://x/v.mp4", { inicio: 42.7, tocar: true })).toContain('src="https://x/v.mp4#t=42"');
    expect(htmlDoVideo("https://x/v.mp4", { tocar: true })).toContain(" autoplay");
    expect(htmlDoVideo("https://x/v.mp4")).not.toContain(" autoplay");
    expect(htmlDoVideo("javascript:alert(1)")).not.toContain("<video");
  });
  it("reconhece a coluna que ainda não existe (42703) e nada mais", () => {
    expect(faltaColuna({ code: "42703", message: "column devocional_itens.video_url does not exist" }, "video_url")).toBe(true);
    expect(faltaColuna({ code: "42501", message: "permission denied" }, "video_url")).toBe(false);
    expect(faltaColuna(null, "video_url")).toBe(false);
  });
});
