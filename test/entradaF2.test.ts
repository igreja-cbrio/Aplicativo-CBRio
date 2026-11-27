// Entrada do app · Fase 2 (27/11/2026). Decisão do Marcos: quem já tem cadastro
// na igreja confirma SEMPRE pelo código enviado ao contato que já estava no
// cadastro. O "Primeiro acesso" vai direto do formulário para o código, a ficha
// preenchida é reenviada depois, e o passo do código sobrevive a sair do app.
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { codigoAbertoValido, montarCodigoAberto } from "../lib/codigoAbertoRegra";
import {
  CODIGO_CONFIRMAR_POR_CODIGO, consumirFichaPendente, guardarFichaPendente, limparRecusaCadastro,
  pedeConfirmacaoPorCodigo, recusaDoErro, type FichaPendente,
} from "../lib/recusaCadastro";
import { TRANSLATIONS as translations } from "../lib/translations";

const ler = (p: string) => fs.readFileSync(path.resolve(__dirname, "..", p), "utf8");
const AGORA = 1_800_000_000_000;
const MIN = 60 * 1000;

describe("a recusa que manda confirmar por código", () => {
  it("reconhece a resposta do servidor", () => {
    const erro = Object.assign(new Error("x"), {
      status: 409, corpo: { codigo: "confirmar_por_codigo", error: "Você já tem cadastro na igreja com este CPF." },
    });
    const recusa = recusaDoErro(erro);
    expect(recusa?.codigo).toBe(CODIGO_CONFIRMAR_POR_CODIGO);
    expect(pedeConfirmacaoPorCodigo(recusa)).toBe(true);
  });
  it("outras recusas e a ausência de recusa não disparam o código", () => {
    expect(pedeConfirmacaoPorCodigo(null)).toBe(false);
    expect(pedeConfirmacaoPorCodigo({ codigo: "campos", campo: "nome", mensagem: "m", status: 400 })).toBe(false);
    expect(pedeConfirmacaoPorCodigo({ codigo: "cpf_com_outra_conta", campo: null, mensagem: "m", status: 409 })).toBe(false);
  });
});

describe("a ficha preenchida espera o código", () => {
  const ficha: FichaPendente = {
    nome_completo: "Maria das Dores", telefone: "21999998888", data_nascimento: "1990-05-10",
    email: "maria@dominio.test", cpf: "11144477735", sexo: "feminino",
  };
  it("é devolvida uma vez só", () => {
    guardarFichaPendente(ficha, AGORA);
    expect(consumirFichaPendente(AGORA + MIN)).toEqual(ficha);
    expect(consumirFichaPendente(AGORA + MIN)).toBeNull();
  });
  it("vence em 20 minutos (é dado da pessoa)", () => {
    guardarFichaPendente(ficha, AGORA);
    expect(consumirFichaPendente(AGORA + 21 * MIN)).toBeNull();
  });
  it("sair da conta apaga a ficha", () => {
    guardarFichaPendente(ficha, AGORA);
    limparRecusaCadastro();
    expect(consumirFichaPendente(AGORA)).toBeNull();
  });
  it("só fica em memória: o arquivo não grava nada no aparelho", () => {
    expect(ler("lib/recusaCadastro.ts")).not.toMatch(/AsyncStorage|SecureStore/);
  });
});

describe("o passo do código sobrevive a sair do app", () => {
  const resposta = {
    verificacao_id: "v-1", canal: "whatsapp", destino_mascarado: "(21) 9****-8888",
    nome_mascarado: "M**** d** D****", expira_em_min: 15,
  };
  it("guarda o pedido, o CPF, o destino mascarado e o prazo", () => {
    expect(montarCodigoAberto(resposta, "111.444.777-35", AGORA)).toEqual({
      cpf: "11144477735", verificacaoId: "v-1", canal: "whatsapp", destino: "(21) 9****-8888",
      nome: "M**** d** D****", expiraEm: AGORA + 15 * MIN,
    });
  });
  it("sem id do pedido ou sem CPF inteiro não há o que guardar", () => {
    expect(montarCodigoAberto({ ...resposta, verificacao_id: undefined }, "11144477735", AGORA)).toBeNull();
    expect(montarCodigoAberto(resposta, "111444777", AGORA)).toBeNull();
  });
  it("servidor antigo (sem prazo e sem destino único) cai no e-mail mascarado e em 10 minutos", () => {
    const antigo = montarCodigoAberto({ verificacao_id: "v-2", email_mascarado: "m***@d***.test" }, "11144477735", AGORA);
    expect(antigo).toMatchObject({ canal: "email", destino: "m***@d***.test", expiraEm: AGORA + 10 * MIN });
  });
  it("vale até o prazo e nem um instante depois", () => {
    const aberto = montarCodigoAberto(resposta, "11144477735", AGORA)!;
    expect(codigoAbertoValido(aberto, AGORA + 15 * MIN - 1)).toEqual(aberto);
    expect(codigoAbertoValido(aberto, AGORA + 15 * MIN)).toBeNull();
  });
  it.each([null, "texto", {}, { verificacaoId: "v", cpf: "123", expiraEm: AGORA + MIN }, { verificacaoId: "", cpf: "11144477735", expiraEm: AGORA + MIN }, { verificacaoId: "v", cpf: "11144477735" }])(
    "conteúdo estragado no aparelho (%j) é descartado",
    (bruto) => { expect(codigoAbertoValido(bruto, AGORA)).toBeNull(); },
  );
  it("o código em si nunca é guardado", () => {
    const aberto = montarCodigoAberto({ ...resposta, codigo: "123456" } as never, "11144477735", AGORA)!;
    expect(JSON.stringify(aberto)).not.toContain("123456");
  });
});

describe("as telas", () => {
  const completar = ler("app/(app)/(principal)/completar-cadastro.tsx");
  const cadastro = ler("app/(auth)/cadastro.tsx");
  const MSG = "Você já tem cadastro na igreja. Para entrar, confirme com o código que enviamos para o contato desse cadastro.";

  it("o formulário recusado por CPF já cadastrado vai ao código com o CPF digitado e guarda a ficha", () => {
    const i = completar.indexOf("if (pedeConfirmacaoPorCodigo(recusa) && cpfDig.length === 11) {");
    expect(i).toBeGreaterThan(0);
    const bloco = completar.slice(i, i + 400);
    expect(bloco).toContain("fichaRef.current = ficha;");
    expect(bloco).toContain("await buscarPorCpf(cpfDig);");
    expect(bloco).toContain("return;");
  });
  it("depois do código, a ficha é reenviada e o passo guardado é apagado", () => {
    const i = completar.indexOf("await confirmarCodigoIdentidade(");
    const bloco = completar.slice(i, i + 700);
    expect(bloco).toContain("await limparCodigoAberto(user?.id);");
    expect(bloco).toContain("await completarCadastroApp(ficha);");
    expect(bloco.indexOf("completarCadastroApp(ficha)")).toBeLessThan(bloco.indexOf("await concluir();"));
  });
  it("pedir o código guarda o passo; ao abrir, a tela volta nele", () => {
    expect(completar).toContain("void guardarCodigoAberto(user?.id, montarCodigoAberto(r, cpfUsado));");
    expect(completar).toContain("lerCodigoAberto(user?.id).then((aberto) => {");
    expect(completar).toContain('setPasso((atual) => (atual === "escolha" ? "codigo" : atual));');
  });
  it("o botão do CPF não passa o evento do toque como se fosse CPF", () => {
    expect(completar).toContain("onPress={() => buscarPorCpf()}");
    expect(completar).not.toContain("onPress={buscarPorCpf}");
  });
  it("quem veio da tela de criar conta leva a ficha junto", () => {
    expect(cadastro).toContain("if (pedeConfirmacaoPorCodigo(recusa)) guardarFichaPendente(ficha);");
    expect(completar).toContain("const ficha = consumirFichaPendente();");
  });
  it("o aviso tem tradução", () => {
    expect(completar).toContain(`t("${MSG}")`);
    expect(translations[MSG]?.en).toBeTruthy();
    expect(translations[MSG]?.es).toBeTruthy();
  });
});
