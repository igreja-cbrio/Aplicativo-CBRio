// Entrada do app · Fase 3 (27/11/2026) · telas. Medido no lançamento: 72
// tentativas de senha no login e 1 certa (quase ninguém tinha conta); 18 CPFs
// pediram "esqueci a senha" sem ter conta e ficaram esperando um e-mail que não
// existia; 61 cadastros recusados por senha fraca, com a regra escondida no
// placeholder (some ao digitar).
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  consumirCpfSemConta, desfechoRecuperar, guardarCpfSemConta, mensagemErroRecuperar, motivoErroRecuperar,
} from "../lib/recuperarSenhaRegra";
import { TRANSLATIONS as translations } from "../lib/translations";

const ler = (p: string) => fs.readFileSync(path.resolve(__dirname, "..", p), "utf8");
const AGORA = 1_800_000_000_000;
const MIN = 60 * 1000;

describe("esqueci a senha · o que a resposta do servidor quer dizer", () => {
  it("semConta manda criar a conta", () => {
    expect(desfechoRecuperar({ emailMascarado: null, semConta: true })).toBe("sem_conta");
  });
  it("e-mail mascarado é link enviado", () => {
    expect(desfechoRecuperar({ emailMascarado: "m***@dominio.test" })).toBe("enviado");
  });
  it("resposta sem nada segue genérica (CPF duplicado, e-mail que não bate)", () => {
    expect(desfechoRecuperar({ emailMascarado: null })).toBe("generico");
    expect(desfechoRecuperar({ emailMascarado: null, semConta: false })).toBe("generico");
    expect(desfechoRecuperar(null)).toBe("generico");
  });
});

describe("esqueci a senha · o erro nunca vai cru para a tela", () => {
  const erro = (status?: number) => Object.assign(new Error("Erro do servidor em inglês"), status ? { status } : {});
  it("cada caso tem texto próprio, com tradução", () => {
    const textos = [erro(429), erro(400), erro(500), erro(), new TypeError("Network request failed")].map(mensagemErroRecuperar);
    expect(textos[0]).toBe("Muitas tentativas. Espere alguns minutos e tente de novo.");
    expect(textos[1]).toBe("Informe um CPF válido.");
    expect(textos[2]).toBe("Não foi possível enviar o e-mail.");
    expect(textos[3]).toBe("Sem conexão com a internet agora. Confira a rede e tente de novo.");
    expect(textos[4]).toBe(textos[3]);
    for (const txt of textos) {
      expect(txt).not.toMatch(/inglês|Network/);
      expect(translations[txt]?.en, txt).toBeTruthy();
      expect(translations[txt]?.es, txt).toBeTruthy();
    }
  });
  it("a telemetria recebe só o enum", () => {
    expect(motivoErroRecuperar(erro(429))).toBe("limite");
    expect(motivoErroRecuperar(erro())).toBe("rede");
    expect(motivoErroRecuperar(erro(500))).toBe("erro");
  });
  it("a tela não mostra e.message e trata o semConta", () => {
    const fonte = ler("app/(auth)/recuperar-senha.tsx");
    expect(fonte).not.toContain("e instanceof Error ? e.message");
    expect(fonte).toContain("setError(t(mensagemErroRecuperar(e)))");
    expect(fonte).toContain('desfecho === "sem_conta"');
    expect(fonte).toContain('router.replace("/(auth)/cadastro")');
  });
});

describe("o CPF sem conta viaja até a tela de criar conta", () => {
  it("é devolvido uma vez só, só com dígitos", () => {
    guardarCpfSemConta("111.444.777-35", AGORA);
    expect(consumirCpfSemConta(AGORA + MIN)).toBe("11144477735");
    expect(consumirCpfSemConta(AGORA + MIN)).toBeNull();
  });
  it("vence em 5 minutos", () => {
    guardarCpfSemConta("11144477735", AGORA);
    expect(consumirCpfSemConta(AGORA + 5 * MIN + 1)).toBeNull();
  });
  it("CPF incompleto não é guardado", () => {
    guardarCpfSemConta("1114447", AGORA);
    expect(consumirCpfSemConta(AGORA)).toBeNull();
  });
  it("fica só em memória e fora da rota", () => {
    expect(ler("lib/recuperarSenhaRegra.ts")).not.toMatch(/import .*(AsyncStorage|SecureStore)/);
    expect(ler("app/(auth)/recuperar-senha.tsx")).not.toMatch(/cadastro\?|params:/);
    expect(ler("app/(auth)/cadastro.tsx")).toContain("consumirCpfSemConta()");
  });
});

describe("tela de entrada · Primeiro acesso é o botão principal", () => {
  const fonte = ler("app/(auth)/login.tsx");
  const bloco = (titulo: string) => {
    const i = fonte.indexOf(`title={t("${titulo}")}`);
    return fonte.slice(i, fonte.indexOf("/>", i));
  };
  it("Primeiro acesso vem antes do Entrar e sem variante ghost", () => {
    expect(fonte.indexOf('title={t("Primeiro acesso")}')).toBeGreaterThan(0);
    expect(fonte.indexOf('title={t("Primeiro acesso")}')).toBeLessThan(fonte.indexOf('title={t("Entrar")}'));
    expect(bloco("Primeiro acesso")).not.toContain('variant="ghost"');
    expect(bloco("Entrar")).toContain('variant="ghost"');
  });
});

describe("a regra da senha fica visível antes de digitar", () => {
  it.each([
    ["app/(auth)/cadastro.tsx"],
    ["app/(auth)/redefinir-senha.tsx"],
    ["app/(app)/(principal)/trocar-senha.tsx"],
  ])("%s usa a ajuda fixa do campo", (p) => {
    expect(ler(p)).toMatch(/ajuda=\{t\("Pelo menos \d caracteres\. Senhas fáceis/);
  });
  it("o cadastro não deixa mais a regra no placeholder", () => {
    expect(ler("app/(auth)/cadastro.tsx")).not.toContain('placeholder={t("Mínimo 6 caracteres');
  });
  it("o número da ajuda é o mesmo que a tela cobra", () => {
    expect(ler("app/(auth)/cadastro.tsx")).toContain("password.length < 6");
    expect(ler("app/(auth)/redefinir-senha.tsx")).toContain("senha.length < 8");
    expect(ler("app/(app)/(principal)/trocar-senha.tsx")).toContain("senha.length < 8");
  });
});
