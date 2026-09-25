import { describe, expect, it } from "vitest";
import { diasDoPlano, edicaoEmFoco, edicoesDoCalendario, ritmoDoPlano, semanasDoPlano, semanaEmFoco } from "@/lib/planoRitmo";
import { faltaColuna, htmlDoVideo, idDoYoutube, navegacaoPermitida, videoSeguro } from "@/lib/videoDevocional";

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

describe("plano por calendário na tela universal", () => {
  const qcd = [
    { id: "a", ordem_no_ciclo: 1, data: "2026-08-31", edicao_slug: "1-cronicas", edicao_titulo: "1 Crônicas" },
    { id: "b", ordem_no_ciclo: 2, data: "2026-09-01", edicao_slug: "1-cronicas", edicao_titulo: "1 Crônicas" },
    { id: "c", ordem_no_ciclo: 3, data: "2026-09-02", edicao_slug: "1-cronicas", edicao_titulo: "1 Crônicas" },
    { id: "d", ordem_no_ciclo: 1, data: "2026-09-07", edicao_slug: "2-samuel", edicao_titulo: "2 Samuel" },
  ];
  it("o ritmo vem do DADO: sentinela = no seu ritmo; data real = calendário", () => {
    expect(ritmoDoPlano([{ data: "2000-01-01" }, { data: "2000-01-02" }])).toBe("ritmo");
    expect(ritmoDoPlano(qcd)).toBe("calendario");
    expect(ritmoDoPlano([])).toBe("ritmo");
  });
  it("agrupa por edição, mais nova primeiro, e o futuro fica trancado", () => {
    const eds = edicoesDoCalendario(qcd, ["a"], "2026-09-01");
    expect(eds.map((e) => e.titulo)).toEqual(["2 Samuel", "1 Crônicas"]);
    expect(eds[1].dias.map((d) => d.estado)).toEqual(["lido", "atual", "bloqueado"]);
    expect(eds[0].dias[0].estado).toBe("bloqueado");
    expect(eds[1].lidos).toBe(1);
  });
  it("dia não lido do PASSADO continua aberto (calendário não tranca o atraso)", () => {
    const eds = edicoesDoCalendario(qcd, [], "2026-09-05");
    expect(eds[1].dias.map((d) => d.estado)).toEqual(["atual", "atual", "atual"]);
  });
  it("foco: a edição de hoje → a última que começou → a primeira", () => {
    const eds = edicoesDoCalendario(qcd, [], "2026-09-01");
    expect(edicaoEmFoco(eds, "2026-09-01")).toBe("1-cronicas");
    expect(edicaoEmFoco(eds, "2026-09-25")).toBe("2-samuel");
    expect(edicaoEmFoco(eds, "2026-09-05")).toBe("1-cronicas");
    expect(edicaoEmFoco(eds, "2026-01-01")).toBe("1-cronicas");
    expect(edicaoEmFoco([], "2026-09-01")).toBeNull();
  });
  it("sem edição, agrupa pela semana da data (segunda a domingo)", () => {
    const eds = edicoesDoCalendario([
      { id: "x", ordem_no_ciclo: null, data: "2026-09-21" },
      { id: "y", ordem_no_ciclo: null, data: "2026-09-27" },
      { id: "z", ordem_no_ciclo: null, data: "2026-09-28" },
    ], [], "2026-09-25");
    expect(eds.map((e) => e.dias.length)).toEqual([1, 2]);
  });
});

describe("vídeo do YouTube dentro do app", () => {
  it("reconhece os formatos de link e devolve o id", () => {
    for (const u of [
      "https://www.youtube.com/watch?v=e2-TJDiAS0U",
      "https://youtube.com/watch?feature=share&v=e2-TJDiAS0U",
      "https://youtu.be/e2-TJDiAS0U?si=abc",
      "https://www.youtube.com/live/e2-TJDiAS0U",
      "https://m.youtube.com/shorts/e2-TJDiAS0U",
      "https://www.youtube.com/embed/e2-TJDiAS0U",
    ]) expect(idDoYoutube(u), u).toBe("e2-TJDiAS0U");
    expect(idDoYoutube("https://vimeo.com/123")).toBeNull();
    expect(idDoYoutube("https://www.youtube.com/watch?v=curto")).toBeNull();
  });
  it("o HTML do YouTube usa o player embutido com o id, nunca o arquivo", () => {
    const h = htmlDoVideo("https://youtu.be/e2-TJDiAS0U", { inicio: 30, tocar: true });
    expect(h).toContain("videoId:'e2-TJDiAS0U'");
    expect(h).toContain("start:30");
    expect(h).toContain("playsinline:1");
    expect(h).not.toContain("<video");
  });
  it("não deixa sair do app: frame principal só na própria página", () => {
    expect(navegacaoPermitida("https://cbrio.org/", true)).toBe(true);
    expect(navegacaoPermitida("about:blank", true)).toBe(true);
    expect(navegacaoPermitida("https://www.youtube.com/watch?v=e2-TJDiAS0U", true)).toBe(false);
    expect(navegacaoPermitida("https://www.youtube.com/watch?v=e2-TJDiAS0U", undefined)).toBe(false);
    expect(navegacaoPermitida("https://www.youtube.com/embed/e2-TJDiAS0U", false)).toBe(true);
  });
});
