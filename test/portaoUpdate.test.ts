// Contrato do portão de atualização (Matheus · 29/08/2026).
// ⚠️ A tela JÁ existia e funcionava. O que faltava era ela DISPARAR na primeira
// abertura depois de instalar — o "instalei e veio a versão antiga".
import { describe, it, expect } from "vitest";
import { decidirAplicacao, leEmbutido } from "../lib/portaoUpdate";

const base = {
  habilitado: true, updatePendente: true, baixouNestaSessao: false,
  lancamentoEmbutido: false, fichaAberta: false,
  checando: false, baixando: false, startupRodando: false,
};

describe("portão de atualização", () => {
  it("⚠️⚠️ o caso do Matheus: instalou, baixou nesta sessão, APLICA", () => {
    // Era exatamente aqui que travava: `baixouNestaSessao` sobe ANTES do fetch
    // (pra fechar uma corrida de 10/08) e bloqueava também a 1ª abertura.
    const r = decidirAplicacao({ ...base, baixouNestaSessao: true, lancamentoEmbutido: true });
    expect(r.aplicar).toBe(true);
    expect(r.motivo).toBe("primeira_abertura");
  });

  it("⚠️ fora do lançamento embutido, baixar nesta sessão NÃO interrompe", () => {
    // A guarda de 07/08 continua: download que termina no meio do uso espera o
    // próximo ciclo em vez de desmontar a árvore do app.
    const r = decidirAplicacao({ ...base, baixouNestaSessao: true });
    expect(r.aplicar).toBe(false);
    expect(r.motivo).toBe("baixou_nesta_sessao");
  });

  it("⚠️⚠️ a FICHA ABERTA segura o portão até no primeiro lançamento", () => {
    // Dá pra instalar, abrir, começar o /completar-cadastro e o download
    // terminar no meio. Aplicar ali apagaria o formulário.
    const r = decidirAplicacao({ ...base, lancamentoEmbutido: true, fichaAberta: true });
    expect(r.aplicar).toBe(false);
    expect(r.motivo).toBe("ficha_aberta");
  });

  it("⚠️ transição em voo bloqueia INCLUSIVE na instalação", () => {
    // Sem isso o reloadAsync reinicia no MESMO bundle e vira o loop de 13/08.
    for (const k of ["checando", "baixando", "startupRodando"] as const) {
      const r = decidirAplicacao({ ...base, lancamentoEmbutido: true, [k]: true });
      expect(r.aplicar, k).toBe(false);
    }
  });

  it("sem update pendente ou com updates desligado, não faz nada", () => {
    expect(decidirAplicacao({ ...base, updatePendente: false }).motivo).toBe("sem_update_pendente");
    expect(decidirAplicacao({ ...base, habilitado: false }).motivo).toBe("updates_desligado");
    expect(decidirAplicacao({}).aplicar).toBe(false);
  });

  it("o caminho normal (2ª abertura) continua aplicando", () => {
    expect(decidirAplicacao(base)).toEqual({ aplicar: true, motivo: "pronto" });
  });

  it("⚠️ isEmbeddedLaunch ausente NÃO vira 'primeira abertura'", () => {
    // `undefined` virando true ligaria a exceção em TODA sessão e traria de
    // volta a interrupção no meio do uso. Na dúvida, comportamento de antes.
    expect(leEmbutido(undefined)).toBe(false);
    expect(leEmbutido(null)).toBe(false);
    expect(leEmbutido("true")).toBe(false);
    expect(leEmbutido(true)).toBe(true);
    expect(leEmbutido(false)).toBe(false);
  });
});
