// Bandeira "ficha aberta" que segura o portão de atualização (lib/cadastroAberto.ts).
// 24/11/2026: login e criar conta também levantam a bandeira; como uma tela pode
// estar empilhada sobre a outra, fechar uma não pode baixar a de quem continua aberta.
import { afterEach, describe, expect, it, vi } from "vitest";
import { abrirFichaCadastro, fecharFichaCadastro, lerFichaCadastro } from "../lib/cadastroAberto";

afterEach(() => {
  while (lerFichaCadastro()) fecharFichaCadastro();
  vi.useRealTimers();
});

describe("ficha aberta", () => {
  it("abre e fecha", () => {
    abrirFichaCadastro();
    expect(lerFichaCadastro()).toBe(true);
    fecharFichaCadastro();
    expect(lerFichaCadastro()).toBe(false);
  });

  it("login por baixo de criar conta: fechar o cadastro não baixa a bandeira do login", () => {
    abrirFichaCadastro(); // login
    abrirFichaCadastro(); // criar conta, empilhado
    fecharFichaCadastro(); // volta ao login
    expect(lerFichaCadastro()).toBe(true);
    fecharFichaCadastro(); // saiu do login
    expect(lerFichaCadastro()).toBe(false);
  });

  it("fechar a mais não deixa o contador negativo", () => {
    fecharFichaCadastro();
    fecharFichaCadastro();
    abrirFichaCadastro();
    expect(lerFichaCadastro()).toBe(true);
    fecharFichaCadastro();
    expect(lerFichaCadastro()).toBe(false);
  });

  it("o teto de 10 minutos baixa tudo (a tela pode morrer sem avisar)", () => {
    vi.useFakeTimers();
    abrirFichaCadastro();
    abrirFichaCadastro();
    vi.advanceTimersByTime(10 * 60 * 1000 + 1);
    expect(lerFichaCadastro()).toBe(false);
    abrirFichaCadastro();
    fecharFichaCadastro();
    expect(lerFichaCadastro()).toBe(false);
  });
});
