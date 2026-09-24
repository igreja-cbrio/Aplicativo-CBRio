// Guarda ESTÁTICA (24/09/2026): mem_devocionais NÃO aceita `upsert`. O índice
// único da tabela é PARCIAL desde 09/09 e o ON CONFLICT do PostgREST não o
// infere — o check-in do devocional caiu em 42P10 por 15 dias sem ninguém ver.
// Lê o código SEM comentário: o comentário do próprio lib explica a proibição
// citando a palavra, e casaria (armadilha de 06/08).
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { semComentarios } from "../scripts/semComentarios.mjs";
import { mensagemDoErro } from "../lib/erroMensagem";

const fonte = semComentarios(readFileSync(resolve(__dirname, "../lib/devocional.ts"), "utf8"));

describe("check-in do devocional · mem_devocionais", () => {
  it("nenhum bloco from(\"mem_devocionais\") chama upsert", () => {
    const blocos = fonte.split('from("mem_devocionais")').slice(1).map((b) => b.split("from(")[0]);
    expect(blocos.length).toBeGreaterThan(0);
    for (const b of blocos) expect(b).not.toMatch(/\.upsert\(/);
  });
  it("o check-in confere se já existe (select) antes de gravar", () => {
    const i = fonte.indexOf("export async function checkInDevocional");
    const corpo = fonte.slice(i, fonte.indexOf("\n}", i));
    expect(corpo).toMatch(/\.is\("deleted_at", null\)/);
    expect(corpo).toMatch(/\.insert\(/);
    expect(corpo).toMatch(/\.update\(/);
  });
});

describe("mensagemDoErro", () => {
  it("Error devolve a message", () => { expect(mensagemDoErro(new Error("x"))).toBe("x"); });
  it("erro do PostgREST (objeto plano) NÃO vira [object Object]", () => {
    const m = mensagemDoErro({ code: "42P10", message: "there is no unique or exclusion constraint", details: null, hint: null });
    expect(m).toContain("42P10");
    expect(m).toContain("no unique");
    expect(m).not.toContain("[object Object]");
  });
  it("string e nulo", () => { expect(mensagemDoErro("falhou")).toBe("falhou"); expect(mensagemDoErro(null)).toBe("null"); });
});
