// Contrato do texto de convite que o MEMBRO manda pra outra pessoa.
//
// ⚠️ O erro aqui chega em quem NÃO é da igreja e não tem o app: mensagem sem
// link, ou com link pela metade, é lixo no WhatsApp de um estranho — e ninguém
// do lado de dentro descobre. Por isso a régua devolve `null` (a tela esconde o
// botão) em vez de montar uma mensagem incompleta.
import { describe, it, expect } from "vitest";
import { mensagemEvento, mensagemPorta, CONVITE_PORTA } from "@/lib/compartilharInscricao";

const URL = "https://www.cbrio.org/evento/celebra";

describe("convite de evento", () => {
  it("leva nome, quando e o link", () => {
    const m = mensagemEvento({ nome: "Celebra 2026", quando: "29 ago · 19:00", url: URL })!;
    expect(m).toContain("Celebra 2026");
    expect(m).toContain("29 ago · 19:00");
    expect(m.endsWith(URL)).toBe(true);
  });

  it("sem data, o convite não inventa nem mostra parêntese vazio", () => {
    const m = mensagemEvento({ nome: "Retiro", quando: null, url: URL })!;
    expect(m).toContain("Retiro");
    expect(m).not.toContain("()");
    expect(m).not.toMatch(/sem data/i);
  });

  // ⚠️⚠️ O caso que a régua existe pra impedir.
  it("SEM LINK devolve null — nunca uma mensagem sem endereço", () => {
    expect(mensagemEvento({ nome: "Celebra", url: null })).toBeNull();
    expect(mensagemEvento({ nome: "Celebra", url: "" })).toBeNull();
    expect(mensagemEvento({ nome: "Celebra", url: "   " })).toBeNull();
  });

  it("sem nome também devolve null (link solto não diz o que é)", () => {
    expect(mensagemEvento({ nome: "", url: URL })).toBeNull();
    expect(mensagemEvento({ nome: "   ", url: URL })).toBeNull();
  });

  it("usa a tradução quando ela vem", () => {
    const m = mensagemEvento({ nome: "Celebra", url: URL }, (s) => s.toUpperCase())!;
    expect(m).toContain("VEM COM A GENTE NA CBRIO");
    expect(m).toContain("Celebra");   // o nome do evento NÃO é traduzido
  });
});

describe("convite de porta", () => {
  it("cada porta da tela tem copy própria", () => {
    for (const chave of ["batismo", "grupos", "next", "voluntariado", "apresentacao"]) {
      expect(CONVITE_PORTA[chave]).toBeTruthy();
      const m = mensagemPorta({ chave, nome: "X", url: "https://www.cbrio.org/x" })!;
      expect(m).toContain(CONVITE_PORTA[chave]);
      expect(m.endsWith("https://www.cbrio.org/x")).toBe(true);
      // ⚠️ Quem recebe é de fora: o texto tem que citar a igreja ou explicar o
      // que é. "Se inscreve aqui" sozinho não diz onde nem em quê.
      expect(m.length).toBeGreaterThan(30);
    }
  });

  // ⚠️ A LISTA de portas vem do SERVIDOR. Porta nova não pode sumir da tela só
  // porque a copy dela ainda não existe no bundle — cai no genérico, com o nome
  // que o servidor mandou.
  it("porta que o servidor mandou sem copy cai no genérico, não desaparece", () => {
    const m = mensagemPorta({ chave: "porta_nova", nome: "Curso de Casais", url: "https://www.cbrio.org/z" });
    expect(m).not.toBeNull();
    expect(m).toContain("Curso de Casais");
    expect(m!.endsWith("https://www.cbrio.org/z")).toBe(true);
  });

  it("sem link devolve null", () => {
    expect(mensagemPorta({ chave: "batismo", nome: "Batismo", url: null })).toBeNull();
    expect(mensagemPorta({ chave: "batismo", nome: "Batismo" })).toBeNull();
  });
});
