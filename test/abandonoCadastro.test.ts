// Abandono do formulário de cadastro por campo (27/11/2026 · Fase 3 da entrada).
// No lançamento, 13 pessoas largaram o formulário e não havia como saber onde.
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { criarMedidorAbandono, primeiroCampoVazio } from "../lib/abandonoCadastro";

const ler = (p: string) => fs.readFileSync(path.resolve(__dirname, "..", p), "utf8");

describe("onde a pessoa parou", () => {
  it("sair sem enviar conta o último campo e os tocados, na ordem", () => {
    const m = criarMedidorAbandono("cadastro");
    m.tocar("nome"); m.tocar("cpf"); m.tocar("nome"); m.tocar("senha");
    expect(m.abandono("saiu")).toEqual({ source: "cadastro", label: "senha", reason: "saiu", action: "nome,cpf,senha" });
  });
  it("abrir e sair sem tocar em nada também é abandono", () => {
    expect(criarMedidorAbandono("cadastro").abandono("saiu")).toEqual({
      source: "cadastro", label: "nenhum", reason: "saiu", action: "",
    });
  });
  it("quem enviou não abandonou (a tela desmonta sozinha quando a conta nasce)", () => {
    const m = criarMedidorAbandono("cadastro");
    m.tocar("nome");
    m.enviar();
    expect(m.abandono("saiu")).toBeNull();
    expect(m.abandono("pausa")).toBeNull();
  });
  it("envio que falhou devolve a pessoa ao formulário", () => {
    const m = criarMedidorAbandono("completar");
    m.tocar("cpf");
    m.enviar();
    m.reabrir();
    expect(m.abandono("saiu")?.label).toBe("cpf");
  });
});

describe("sair do app com o formulário aberto", () => {
  it("uma pausa por saída; tocar em outro campo libera a próxima", () => {
    const m = criarMedidorAbandono("cadastro");
    m.tocar("email");
    expect(m.abandono("pausa")?.reason).toBe("pausa");
    expect(m.abandono("pausa")).toBeNull();
    m.tocar("senha");
    expect(m.abandono("pausa")?.label).toBe("senha");
  });
  it("sem campo tocado não manda pausa", () => {
    expect(criarMedidorAbandono("cadastro").abandono("pausa")).toBeNull();
  });
  it("a pausa não esconde a saída de verdade", () => {
    const m = criarMedidorAbandono("cadastro");
    m.tocar("email");
    m.abandono("pausa");
    expect(m.abandono("saiu")?.reason).toBe("saiu");
  });
});

describe("o primeiro campo vazio", () => {
  it("segue a ordem da tela", () => {
    expect(primeiroCampoVazio([["nome", "Maria"], ["cpf", ""], ["senha", ""]])).toBe("cpf");
    expect(primeiroCampoVazio([["nome", "  "]])).toBe("nome");
    expect(primeiroCampoVazio([["nome", "Maria"]])).toBe("nenhum");
  });
});

describe("sem dado da pessoa", () => {
  it("a régua só conhece nomes de campo", () => {
    const m = criarMedidorAbandono("cadastro");
    m.tocar("cpf");
    expect(Object.keys(m.abandono("saiu")!).sort()).toEqual(["action", "label", "reason", "source"]);
  });
  it("as chaves do evento são as que o servidor aceita", () => {
    const aceitas = new Set(["message", "fatal", "screen", "route", "action", "reason", "status_code", "endpoint", "permission", "notification_type", "source", "entity_id", "label"]);
    const m = criarMedidorAbandono("cadastro");
    for (const chave of Object.keys(m.abandono("saiu")!)) expect(aceitas.has(chave), chave).toBe(true);
    expect(ler("lib/useAbandonoCadastro.ts")).toContain("trackEvento(EVENTO_CAMPO_INVALIDO, { source, label: campo })");
  });
  it("as telas mandam nome de campo fixo, nunca o valor", () => {
    for (const p of ["app/(auth)/cadastro.tsx", "app/(app)/(principal)/completar-cadastro.tsx"]) {
      const fonte = ler(p);
      const toques = [...fonte.matchAll(/abandono\.(?:tocar|invalido)\(([^)]*)\)/g)].map((x) => x[1]);
      expect(toques.length, p).toBeGreaterThan(5);
      for (const arg of toques) {
        expect(/^"[a-z]+"$/.test(arg) || arg.startsWith("primeiroCampoVazio("), `${p}: ${arg}`).toBe(true);
      }
    }
  });
});

describe("as telas", () => {
  it("o cadastro marca o envio ANTES do signUp e reabre quando a conta não nasce", () => {
    const fonte = ler("app/(auth)/cadastro.tsx");
    expect(fonte.indexOf("abandono.enviar();")).toBeGreaterThan(0);
    expect(fonte.indexOf("abandono.enviar();")).toBeLessThan(fonte.indexOf("await signUp("));
    expect(fonte).toContain("abandono.reabrir();");
  });
  it("o completar cadastro só mede com o formulário na tela", () => {
    expect(ler("app/(app)/(principal)/completar-cadastro.tsx")).toContain('useAbandonoCadastro("completar", passo === "form")');
  });
  it("todos os campos do cadastro avisam o toque", () => {
    const fonte = ler("app/(auth)/cadastro.tsx");
    for (const campo of ["nome", "cpf", "nascimento", "telefone", "email", "senha", "sexo"]) {
      expect(fonte, campo).toContain(`abandono.tocar("${campo}")`);
    }
  });
});
