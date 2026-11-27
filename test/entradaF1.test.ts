// Entrada do app · Fase 1 (26/11/2026). Cada bloco cita o que foi medido no
// lançamento de 25/11.
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { erroNomeCompleto, temAbreviacaoNome, ERRO_NOME_ABREVIADO, ERRO_NOME_INCOMPLETO } from "../lib/nomeCompleto";
import { consumirRecusaCadastro, guardarRecusaCadastro, limparRecusaCadastro, recusaDoErro } from "../lib/recusaCadastro";
import { ehCancelamentoLogin, erroProprio, mensagemErroLogin, motivoErroLogin } from "../lib/erroAuth";
import { TRANSLATIONS as translations } from "../lib/translations";

const ler = (p: string) => fs.readFileSync(path.resolve(__dirname, "..", p), "utf8");

describe("nome completo · mesma tabela de casos do ERP (inscricaoContrato + camposContato)", () => {
  // 2 de 84 cadastros recusados: um só com o primeiro nome, outro com "S.".
  it.each([
    ["Marcos", ERRO_NOME_INCOMPLETO],
    ["", ERRO_NOME_INCOMPLETO],
    ["Ana B", ERRO_NOME_ABREVIADO],
    ["Li Wu", null],
    ["A B", ERRO_NOME_INCOMPLETO],
    ["Maria S. Santos", ERRO_NOME_ABREVIADO],
    ["Maria S Santos", ERRO_NOME_ABREVIADO],
    ["João da Silva", null],
    ["Ana e Silva", null],
    ["  Maria   das  Dores  ", null],
    ["Pedro Paiva", null],
  ])("%j → %j", (nome, esperado) => {
    expect(erroNomeCompleto(nome as string)).toBe(esperado);
  });
  it("conectivo passa, inicial não", () => {
    expect(temAbreviacaoNome("Maria de Souza")).toBe(false);
    expect(temAbreviacaoNome("Maria D Souza")).toBe(true);
  });
});

describe("recusa do cadastro viaja até a tela seguinte", () => {
  const erroApi = (status: number, corpo: unknown) => Object.assign(new Error("x"), { status, corpo });

  it("lê a recusa do servidor (código, campo, mensagem)", () => {
    expect(recusaDoErro(erroApi(400, { error: "Escreva o nome completo, sem abreviações.", codigo: "campos", campo: "nome_completo" })))
      .toEqual({ codigo: "campos", campo: "nome_completo", mensagem: "Escreva o nome completo, sem abreviações.", status: 400 });
    expect(recusaDoErro(erroApi(409, { error: "Já existe um cadastro...", codigo: "dados_nao_conferem" })))
      .toMatchObject({ codigo: "dados_nao_conferem", campo: null, status: 409 });
  });
  it("falha de rede, 500 e resposta sem corpo NÃO são recusa", () => {
    expect(recusaDoErro(new TypeError("Network request failed"))).toBeNull();
    expect(recusaDoErro(erroApi(500, { error: "Não foi possível salvar seus dados agora." }))).toBeNull();
    expect(recusaDoErro(erroApi(400, null))).toBeNull();
    expect(recusaDoErro(null)).toBeNull();
  });
  it("consome uma vez só", () => {
    const r = { codigo: "campos", campo: "nome_completo", mensagem: "m", status: 400 };
    guardarRecusaCadastro(r, 1000);
    expect(consumirRecusaCadastro(2000)).toEqual(r);
    expect(consumirRecusaCadastro(2000)).toBeNull();
  });
  it("vence em 2 minutos e some ao sair da conta", () => {
    const r = { codigo: "campos", campo: null, mensagem: "m", status: 400 };
    guardarRecusaCadastro(r, 0);
    expect(consumirRecusaCadastro(2 * 60 * 1000 + 1)).toBeNull();
    guardarRecusaCadastro(r, 0);
    limparRecusaCadastro();
    expect(consumirRecusaCadastro(1)).toBeNull();
  });
  it("o cadastro guarda a recusa e a tela de completar a consome ao montar", () => {
    const cadastro = ler("app/(auth)/cadastro.tsx");
    expect(cadastro).toContain("guardarRecusaCadastro(recusa)");
    // valida o nome ANTES de criar a conta
    expect(cadastro.indexOf("erroNomeCompleto(nome)")).toBeGreaterThan(0);
    expect(cadastro.indexOf("erroNomeCompleto(nome)")).toBeLessThan(cadastro.indexOf("await signUp("));
    const completar = ler("app/(app)/(principal)/completar-cadastro.tsx");
    // Desde 27/11 há um desvio no meio (recusa que pede código vai ao código);
    // as outras recusas seguem abrindo o formulário com o motivo.
    expect(completar).toMatch(/consumirRecusaCadastro\(\);\s*if \(!recusa\) return;/);
    expect(completar).toMatch(/setPasso\("form"\);\s*setAviso\(recusa\.mensagem\);/);
    expect(completar).toContain("erroNomeCompleto(nome)");
  });
});

describe("login em português", () => {
  // 72 tentativas de senha, 1 certa: a tela mostrava "Invalid login credentials".
  it("senha errada, rede e limite saem em português", () => {
    expect(mensagemErroLogin({ code: "invalid_credentials", message: "Invalid login credentials" }, "p")).toBe("E-mail ou senha incorretos.");
    expect(mensagemErroLogin(new TypeError("Network request failed"), "p")).toBe("Sem conexão com a internet agora. Confira a rede e tente de novo.");
    expect(mensagemErroLogin({ status: 429, message: "x" }, "p")).toBe("Muitos acessos agora. Tente de novo em instantes.");
  });
  it("texto desconhecido do provedor nunca vai para a tela", () => {
    expect(mensagemErroLogin(new Error("access_denied: user did something"), "Não foi possível entrar.")).toBe("Não foi possível entrar.");
  });
  it("mensagem própria passa como está e tem tradução", () => {
    const e = erroProprio("Não foi possível obter o token da Apple.");
    expect(mensagemErroLogin(e, "p")).toBe("Não foi possível obter o token da Apple.");
    expect(motivoErroLogin(e)).toBe("provedor");
    const fonte = ler("contexts/AuthContext.tsx");
    const proprias = [...fonte.matchAll(/erroProprio\(\s*"([^"]+)"/g)].map((m) => m[1]);
    expect(proprias.length).toBeGreaterThanOrEqual(6);
    for (const msg of proprias) {
      expect(translations[msg]?.en, `sem tradução en: ${msg}`).toBeTruthy();
      expect(translations[msg]?.es, `sem tradução es: ${msg}`).toBeTruthy();
    }
  });
  it("cancelar a janela da Apple não mostra erro", () => {
    const cancelou = Object.assign(new Error("The user canceled the authorization attempt"), { code: "ERR_REQUEST_CANCELED" });
    expect(ehCancelamentoLogin(cancelou)).toBe(true);
    expect(mensagemErroLogin(cancelou, "p")).toBeNull();
    expect(motivoErroLogin(cancelou)).toBe("cancelou");
  });
  it("o motivo da telemetria é enum, nunca a mensagem", () => {
    expect(motivoErroLogin({ code: "invalid_credentials", message: "Invalid login credentials for a@b.c" })).toBe("senha_errada");
    expect(motivoErroLogin(new Error("qualquer coisa com a@b.c"))).toBe("outro");
  });
  it("a tela de login usa a régua e não mostra e.message", () => {
    const fonte = ler("app/(auth)/login.tsx");
    expect(fonte).toContain('mensagemErroLogin(e, "Não foi possível entrar.")');
    expect(fonte).not.toContain("e instanceof Error ? e.message");
    expect(fonte).not.toContain("traduzErro");
    // o AuthContext não joga mais o texto do provedor na tela
    expect(ler("contexts/AuthContext.tsx")).not.toContain("throw new Error(decodeURIComponent(erroProvedor)");
  });
});

describe("telemetria da entrada", () => {
  it("os quatro eventos de recusa saem com envio imediato", () => {
    const login = ler("app/(auth)/login.tsx");
    const cadastro = ler("app/(auth)/cadastro.tsx");
    const completar = ler("app/(app)/(principal)/completar-cadastro.tsx");
    expect(login).toContain('trackEventoJa("login_recusado", { label: "senha"');
    expect(login).toContain('trackEventoJa("login_recusado", { label: provider');
    expect(cadastro).toContain('motivo === "senha_fraca" ? "senha_fraca" : "cadastro_recusado"');
    expect(cadastro).toContain('trackEventoJa("cadastro_recusado"');
    expect(completar).toContain('trackEventoJa("ficha_recusada"');
    const tele = ler("lib/telemetria.ts");
    expect(tele).toMatch(/export function trackEventoJa\([^)]*\) \{\s*enfileirar\(\{ tipo: "acao", nome, props \}\);\s*flushTelemetria\(\);/);
  });
  it("só chaves que o servidor aceita (ALLOWED_PROPS do ERP)", () => {
    const aceitas = new Set(["message", "fatal", "screen", "route", "action", "reason", "status_code", "endpoint", "permission", "notification_type", "source", "entity_id", "label"]);
    for (const p of ["app/(auth)/login.tsx", "app/(auth)/cadastro.tsx", "app/(app)/(principal)/completar-cadastro.tsx"]) {
      for (const m of ler(p).matchAll(/trackEventoJa\(\s*[^,]+,\s*(?:recusa\s*\?\s*)?\{([^}]*)\}/g)) {
        for (const chave of m[1].matchAll(/(\w+)\s*:/g)) expect(aceitas.has(chave[1]), `${p}: ${chave[1]}`).toBe(true);
      }
    }
  });
});

describe("notif_tap_sem_destino falso no Android", () => {
  // 83 eventos no lançamento, todos "(sem tipo)", um a cada partida a frio.
  it("resposta sem identificador e sem data sai antes de qualquer evento", () => {
    const fonte = ler("lib/notifTap.ts");
    const go = fonte.slice(fonte.indexOf("function go("));
    const guarda = go.indexOf("if (!id && !date) return;");
    expect(guarda).toBeGreaterThan(0);
    expect(guarda).toBeLessThan(go.indexOf("marcarProcessada(resp);"));
    expect(guarda).toBeLessThan(go.indexOf('trackEvento("notif_tap_sem_destino"'));
  });
});
