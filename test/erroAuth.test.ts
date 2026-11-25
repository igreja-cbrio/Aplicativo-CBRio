// Erros do Supabase Auth em português (24/11/2026). Ver lib/erroAuth.ts.
// Logs de produção de 23–24/11: 14 cadastros recusados com a mensagem em inglês
// de senha fraca, 4 com "User already registered".
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { semComentarios } from "../scripts/semComentarios.mjs";
import { codigoErroAuth, MENSAGENS_ERRO_AUTH, mensagemErroAuth } from "../lib/erroAuth";
import { TRANSLATIONS } from "../lib/translations";

const erro = (o: Record<string, unknown>) => Object.assign(new Error(String(o.message ?? "x")), o);

describe("código do erro", () => {
  it("senha fraca: pelo código, pelo nome da classe e pelo texto", () => {
    expect(codigoErroAuth(erro({ code: "weak_password" }))).toBe("senha_fraca");
    expect(codigoErroAuth(erro({ name: "AuthWeakPasswordError" }))).toBe("senha_fraca");
    expect(codigoErroAuth(erro({ message: "Password is known to be weak and easy to guess, please choose a different one." }))).toBe("senha_fraca");
  });
  it("conta já existe", () => {
    expect(codigoErroAuth(erro({ code: "user_already_exists" }))).toBe("ja_tem_conta");
    expect(codigoErroAuth(erro({ message: "User already registered" }))).toBe("ja_tem_conta");
  });
  it("limite (Wi-Fi da igreja, um IP só)", () => {
    expect(codigoErroAuth(erro({ status: 429 }))).toBe("limite");
    expect(codigoErroAuth(erro({ code: "over_request_rate_limit" }))).toBe("limite");
    expect(codigoErroAuth(erro({ message: "Request rate limit reached" }))).toBe("limite");
  });
  it("rede, senha errada, e-mail inválido e não confirmado", () => {
    expect(codigoErroAuth(erro({ name: "AuthRetryableFetchError", message: "Network request failed" }))).toBe("rede");
    expect(codigoErroAuth(erro({ message: "Invalid login credentials" }))).toBe("senha_errada");
    expect(codigoErroAuth(erro({ code: "email_address_invalid" }))).toBe("email_invalido");
    expect(codigoErroAuth(erro({ code: "email_not_confirmed" }))).toBe("email_nao_confirmado");
    expect(codigoErroAuth(erro({ code: "same_password" }))).toBe("senha_igual");
    expect(codigoErroAuth(erro({ message: "New password should be different from the old password." }))).toBe("senha_igual");
  });
  it("o resto vira o padrão da tela (nunca o inglês cru)", () => {
    expect(mensagemErroAuth(erro({ message: "Database error saving new user" }), "Não foi possível criar a conta.")).toBe("Não foi possível criar a conta.");
    expect(mensagemErroAuth(null, "Padrão")).toBe("Padrão");
    expect(mensagemErroAuth("texto solto", "Padrão")).toBe("Padrão");
  });
});

describe("textos", () => {
  it("toda mensagem tem tradução en/es", () => {
    for (const m of Object.values(MENSAGENS_ERRO_AUTH)) {
      expect(TRANSLATIONS[m], m).toBeDefined();
      expect(TRANSLATIONS[m].en && TRANSLATIONS[m].es, m).toBeTruthy();
    }
  });
});

describe("as telas usam o tradutor (nada de e.message cru)", () => {
  const ler = (p: string) => semComentarios(readFileSync(join(__dirname, "..", p), "utf8"));
  it.each(["app/(auth)/cadastro.tsx", "app/(app)/trocar-senha.tsx", "app/(auth)/redefinir-senha.tsx"])("%s", (p) => {
    const fonte = ler(p);
    expect(fonte).toContain("mensagemErroAuth(e,");
    expect(fonte).not.toMatch(/e instanceof Error \? e\.message/);
  });
  it("criar conta NÃO entra sozinho em conta existente (família divide e-mail e senha)", () => {
    const fonte = ler("app/(auth)/cadastro.tsx");
    expect(fonte).not.toMatch(/signIn\(/);
  });
  it("redefinir senha mantém o aviso de link inválido (vem em português de lib/passwordRecovery)", () => {
    expect(ler("app/(auth)/redefinir-senha.tsx")).toContain('e.message === "Link de recuperação inválido." ? e.message : null');
  });
});
