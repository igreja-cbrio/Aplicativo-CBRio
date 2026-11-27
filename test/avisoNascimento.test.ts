// Aviso "confirme seu nascimento" por cima da Home (27/11/2026 · Fase 3 da
// entrada). Decisão do Marcos: quem já está dentro com data suspeita não é
// bloqueado; pode recusar, e o aviso volta até preencher.
import { beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  DISPENSA_MS, avisoNascimentoDispensado, conferirNascimentoDigitado, dispensarAvisoNascimento,
  limparDispensasNascimento, mensagemErroNascimento, motivoErroNascimento, nascimentoJaResolvido,
  podeMostrarAvisoNascimento,
} from "../lib/avisoNascimentoRegra";
import { TRANSLATIONS as translations } from "../lib/translations";

const ler = (p: string) => fs.readFileSync(path.resolve(__dirname, "..", p), "utf8");
const HOJE = "2026-11-27";
const AGORA = 1_800_000_000_000;
const pronto = {
  suspeito: true, confirmado: false, dispensado: false, cadastroReady: true,
  tutorialReady: true, tutorialPending: false, pushReady: true, home: true, active: true, menuOpen: false,
};

describe("quando o aviso aparece", () => {
  it("com a Home parada e a marca do servidor", () => {
    expect(podeMostrarAvisoNascimento(pronto)).toBe(true);
  });
  it.each([
    ["sem marca do servidor", { suspeito: false }],
    ["já confirmou nesta sessão", { confirmado: true }],
    ["tocou Agora não", { dispensado: true }],
    ["cadastro ainda não liberado", { cadastroReady: false }],
    ["tutorial ainda carregando", { tutorialReady: false }],
    ["tutorial na tela", { tutorialPending: true }],
    ["convite de notificações na frente", { pushReady: false }],
    ["fora da Home", { home: false }],
    ["app em segundo plano", { active: false }],
    ["menu aberto", { menuOpen: true }],
  ])("não aparece: %s", (_nome: string, troca: Partial<typeof pronto>) => {
    expect(podeMostrarAvisoNascimento({ ...pronto, ...troca })).toBe(false);
  });
});

describe("recusar não é para sempre", () => {
  beforeEach(() => limparDispensasNascimento());
  it("a dispensa vale por conta e por um prazo", () => {
    expect(avisoNascimentoDispensado("a", AGORA)).toBe(false);
    dispensarAvisoNascimento("a", AGORA);
    expect(avisoNascimentoDispensado("a", AGORA + DISPENSA_MS - 1)).toBe(true);
    expect(avisoNascimentoDispensado("b", AGORA)).toBe(false);
    expect(avisoNascimentoDispensado("a", AGORA + DISPENSA_MS)).toBe(false);
  });
  it("fica só em memória: fechar o app traz o aviso de volta", () => {
    expect(ler("lib/avisoNascimentoRegra.ts")).not.toMatch(/import .*(AsyncStorage|SecureStore)/);
  });
});

describe("a data digitada é conferida antes de ir ao servidor", () => {
  it("data boa vira ISO", () => {
    expect(conferirNascimentoDigitado("14/07/1981", HOJE)).toEqual({ ok: true, iso: "1981-07-14" });
  });
  it.each(["", "14/07", "14/07/81", "31/02/1990", "00/01/1990", "10/13/1990", "01/01/1919", "28/11/2026"])(
    "recusa %s", (br: string) => {
      expect(conferirNascimentoDigitado(br, HOJE).ok).toBe(false);
    });
  it("13 anos feitos hoje passa; um dia a menos não (mesmo piso do servidor)", () => {
    expect(conferirNascimentoDigitado("27/11/2013", HOJE).ok).toBe(true);
    expect(conferirNascimentoDigitado("28/11/2013", HOJE)).toEqual({
      ok: false, erro: "Informe a sua data de nascimento, não a de um filho.",
    });
  });
  it("1920 é o primeiro ano aceito", () => {
    expect(conferirNascimentoDigitado("01/01/1920", HOJE).ok).toBe(true);
  });
  it("todo texto de erro tem tradução", () => {
    const erros = [conferirNascimentoDigitado("", HOJE), conferirNascimentoDigitado("28/11/2013", HOJE)]
      .map((r) => (r.ok ? "" : r.erro));
    erros.push(mensagemErroNascimento(new TypeError("Network request failed")));
    erros.push(mensagemErroNascimento(Object.assign(new Error("x"), { status: 500, corpo: {} })));
    for (const txt of erros) {
      expect(translations[txt]?.en, txt).toBeTruthy();
      expect(translations[txt]?.es, txt).toBeTruthy();
    }
  });
});

describe("resposta do servidor", () => {
  const erro = (status: number, codigo?: string) =>
    Object.assign(new Error("texto do servidor"), { status, corpo: codigo ? { codigo, error: "texto do servidor" } : {} });
  it("já confirmado some sem erro", () => {
    expect(nascimentoJaResolvido(erro(409, "nascimento_ja_confirmado"))).toBe(true);
    expect(nascimentoJaResolvido(erro(400, "nascimento_invalido"))).toBe(false);
    expect(nascimentoJaResolvido(new Error("rede"))).toBe(false);
  });
  it("nunca mostra o texto cru", () => {
    for (const e of [erro(400, "nascimento_invalido"), erro(500), erro(429), new Error("texto do servidor")]) {
      expect(mensagemErroNascimento(e)).not.toContain("texto do servidor");
    }
    expect(mensagemErroNascimento(new Error("x"))).toBe("Sem conexão com a internet agora. Confira a rede e tente de novo.");
  });
  it("a telemetria recebe só o enum", () => {
    expect(motivoErroNascimento(erro(400, "nascimento_invalido"))).toBe("nascimento_invalido");
    expect(motivoErroNascimento(erro(500))).toBe("erro");
    expect(motivoErroNascimento(new Error("x"))).toBe("rede");
  });
});

describe("a tela", () => {
  const aviso = ler("components/auth/AvisoNascimento.tsx");
  it("manda a data em ISO pela rota certa e nunca a data na telemetria", () => {
    expect(ler("lib/api.ts")).toContain('apiPost("/app/identidade/nascimento", { data_nascimento: dataNascimentoISO })');
    for (const m of aviso.matchAll(/trackEvento(?:Ja)?\(\s*[^,]+,\s*\{([^}]*)\}/g)) {
      expect(m[1].replace(/\s/g, "")).toMatch(/^reason:[^,]+$/);
    }
  });
  it("o KeyboardAvoidingView nunca fica com behavior undefined", () => {
    expect(aviso).toContain('behavior={Platform.OS === "ios" ? "padding" : "height"}');
  });
  it("tem a saída Agora não e fica montada dentro do portão do cadastro", () => {
    expect(aviso).toContain('title={t("Agora não")}');
    const layout = ler("app/(app)/_layout.tsx");
    expect(layout.indexOf("<AvisoNascimento />")).toBeGreaterThan(layout.indexOf("<CadastroGate>"));
    expect(layout.indexOf("<AvisoNascimento />")).toBeLessThan(layout.indexOf("</CadastroGate>"));
  });
  it("o portão só entrega a marca para a conta que o servidor respondeu", () => {
    const gate = ler("components/auth/CadastroGate.tsx");
    expect(gate).toContain("s.completo && s.nascimento_suspeito === true ? user?.id ?? null : null");
  });
});
