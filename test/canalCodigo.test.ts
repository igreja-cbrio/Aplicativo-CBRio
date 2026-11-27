// Código por e-mail OU WhatsApp (27/11/2026): quem decide os canais é o servidor.
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { opcoesDeCanal, passoDepoisDoCpf } from "../lib/canalCodigo";

const ler = (p: string) => fs.readFileSync(path.resolve(__dirname, "..", p), "utf8");
const email = { canal: "email", destino_mascarado: "mar***@gmail.com" };
const whats = { canal: "whatsapp", destino_mascarado: "(21) *****-8888" };

describe("próximo passo depois do CPF", () => {
  it("não achou, ou achou sem contato que sirva de prova: formulário", () => {
    expect(passoDepoisDoCpf({ encontrado: false })).toEqual({ tipo: "sem_caminho" });
    expect(passoDepoisDoCpf({ encontrado: true, pode_confirmar: false })).toEqual({ tipo: "sem_caminho" });
    expect(passoDepoisDoCpf({ encontrado: true, pode_confirmar: true, canais: [] })).toEqual({ tipo: "sem_caminho" });
  });
  it("servidor antigo já enviou o código: vai direto aos 6 números", () => {
    expect(passoDepoisDoCpf({ encontrado: true, pode_confirmar: true, verificacao_id: "v1" })).toEqual({ tipo: "codigo" });
    // mesmo que venha a lista junto, o código já saiu
    expect(passoDepoisDoCpf({ encontrado: true, pode_confirmar: true, verificacao_id: "v1", canais: [email, whats] })).toEqual({ tipo: "codigo" });
  });
  it("um canal só: pede o código sem perguntar (quem não tem e-mail vai de WhatsApp)", () => {
    expect(passoDepoisDoCpf({ encontrado: true, pode_confirmar: true, canais: [whats] })).toEqual({ tipo: "pedir", canal: "whatsapp" });
    expect(passoDepoisDoCpf({ encontrado: true, pode_confirmar: true, canais: [email] })).toEqual({ tipo: "pedir", canal: "email" });
  });
  it("dois canais: a pessoa escolhe", () => {
    expect(passoDepoisDoCpf({ encontrado: true, pode_confirmar: true, canais: [email, whats] }))
      .toEqual({ tipo: "escolher", canais: [email, whats] });
  });
});

describe("lista de canais do servidor", () => {
  it("ignora canal desconhecido, repetido e lixo", () => {
    expect(opcoesDeCanal([email, { canal: "sms" }, email, null, "x", whats])).toEqual([email, whats]);
    expect(opcoesDeCanal(undefined)).toEqual([]);
    expect(opcoesDeCanal([{ canal: "email" }])).toEqual([{ canal: "email", destino_mascarado: null }]);
  });
});

describe("a tela", () => {
  const fonte = ler("app/(app)/(principal)/completar-cadastro.tsx");
  it("consulta os canais antes de enviar e nunca manda destino digitado", () => {
    expect(fonte).toContain("identidadePorCpf(cpfUsado, { consultar: true })");
    expect(fonte).toContain("identidadePorCpf(cpfUsado, { canal })");
    const api = ler("lib/api.ts");
    const corpo = api.slice(api.indexOf("export function identidadePorCpf("), api.indexOf("export function confirmarCodigoIdentidade("));
    expect(corpo).not.toMatch(/telefone|email:/);
  });
  it("o passo do código diz por onde o código foi", () => {
    expect(fonte).toContain('achado?.canal === "whatsapp" ? t("Enviamos um código pro WhatsApp") : t("Enviamos um código pro e-mail")');
  });
});
