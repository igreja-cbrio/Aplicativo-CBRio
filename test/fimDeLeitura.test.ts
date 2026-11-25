import { describe, expect, it } from "vitest";
import { chegouAoFim } from "../lib/fimDeLeitura";

describe("chegouAoFim (capítulo conta em Investir só no fim)", () => {
  const base = { alturaVisivel: 700, alturaConteudo: 3000, folgaFinal: 300 };
  it("abrir o capítulo (rolagem 0) não conta", () => {
    expect(chegouAoFim({ ...base, rolagem: 0 })).toBe(false);
  });
  it("no meio não conta", () => {
    expect(chegouAoFim({ ...base, rolagem: 1200 })).toBe(false);
  });
  it("chegar ao último versículo conta, mesmo sem rolar a folga vazia", () => {
    expect(chegouAoFim({ ...base, rolagem: 3000 - 300 - 700 })).toBe(true);
    expect(chegouAoFim({ ...base, rolagem: 3000 - 300 - 700 - 30 })).toBe(true);
    expect(chegouAoFim({ ...base, rolagem: 3000 - 300 - 700 - 100 })).toBe(false);
  });
  it("texto que cabe na tela conta de cara", () => {
    expect(chegouAoFim({ rolagem: 0, alturaVisivel: 700, alturaConteudo: 900, folgaFinal: 300 })).toBe(true);
  });
  it("medidas ainda zeradas (antes do layout) não contam", () => {
    expect(chegouAoFim({ rolagem: 0, alturaVisivel: 0, alturaConteudo: 0 })).toBe(false);
  });
});

import { htmlDoVideo } from "../lib/videoDevocional";
describe("vídeo do devocional avisa quando termina (conta em Investir)", () => {
  it("arquivo próprio: evento ended manda {fim:true}", () => {
    expect(htmlDoVideo("https://x/v.mp4")).toMatch(/addEventListener\('ended',function\(\)\{m\(\{fim:true\}\)\}\)/);
  });
  it("YouTube: estado 0 (ENDED) manda {fim:true}", () => {
    expect(htmlDoVideo("https://www.youtube.com/watch?v=e2-TJDiAS0U")).toContain("onStateChange:function(e){if(e.data===0)m({fim:true})}");
  });
});
