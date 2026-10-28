import { beforeEach, describe, expect, it, vi } from "vitest";
const sessao = vi.hoisted(() => vi.fn());
vi.mock("../lib/supabase", () => ({ supabase: { auth: { getSession: sessao } } }));
import { buscarEventoParticipante, enviarInscricaoParticipante, suportaParticipanteNativo, type EventoPublico } from "../lib/inscricaoParticipante";

describe("inscrição nativa de outro participante", () => {
  beforeEach(() => { vi.clearAllMocks(); vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) })); });
  it("envia apenas dados digitados ao endpoint público, sem JWT ou ID do titular", async () => {
    const ficha = { nome: " Participante Exemplo ", cpf: "111.222.333-44", telefone: "(21) 90000-0000",
      email: " participante@example.test ", dataNascimento: "2014-02-02", genero: "masculino", membro_id: "titular", user_id: "conta" };
    await enviarInscricaoParticipante("classe-batismo", ficha, { convite: "Sim" }, true, false, "");
    expect(sessao).not.toHaveBeenCalled();
    expect(fetch).toHaveBeenCalledWith("https://www.cbrio.org/api/public/evento/classe-batismo/inscrever", {
      method: "POST", headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({ nome_completo: "Participante Exemplo", telefone: "21900000000", cpf: "11122233344",
        email: "participante@example.test", data_nascimento: "2014-02-02", sexo: "masculino", dados: { convite: "Sim" },
        aceita_termos: true, whatsapp_optin: false, endereco: null }),
    });
  });
  it("não grava aceite automático nem envia sem confirmação", () => {
    expect(() => enviarInscricaoParticipante("classe", {}, {}, false, false, "")).toThrow("aceitar os termos");
    expect(fetch).not.toHaveBeenCalled();
  });
  it("busca configuração e texto dos aceites sem sessão", async () => {
    await buscarEventoParticipante("classe");
    expect(sessao).not.toHaveBeenCalled();
    expect(fetch).toHaveBeenCalledWith("https://www.cbrio.org/api/public/evento/textos", { headers: { Accept: "application/json" } });
  });
  it("rejeita caminhos inválidos sem fazer requisição", async () => {
    await expect(buscarEventoParticipante("../app/eventos")).rejects.toThrow();
    expect(fetch).not.toHaveBeenCalled();
  });
  it("preserva erro do backend em vez de anunciar inscrição confirmada", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({ ok: false, status: 400, json: async () => ({ error: "CPF inválido" }) } as Response);
    await expect(enviarInscricaoParticipante("classe", {}, {}, true, false, "")).rejects.toThrow("CPF inválido");
  });
  const evento: EventoPublico = { nome: "Classe", slug: "classe", form_ativo: true, campos: [{ key: "horario", label: "Horário", tipo: "select", opcoes: ["9h", "19h"] }] };
  it("usa controles nativos para contrato completo ou mínimo", () => {
    expect(suportaParticipanteNativo(evento)).toBe(true);
    expect(suportaParticipanteNativo({ ...evento, contrato: "minimo", exigir_endereco: true })).toBe(true);
  });
  it.each([
    { exige_dados_menor: true }, { termos_extra: [{ chave: "autorizacao" }] },
    { checkout_externo: { exclusivo: true } }, { contrato: "futuro" },
    { campos: [{ key: "foto", label: "Foto", tipo: "imagem" }] },
    { campos: [{ key: "saude", label: "Saúde", mostrar_se: { key: "alergia", valores: ["sim"] } }] },
  ])("não pula campos ou autorizações especiais: %j", especial => {
    expect(suportaParticipanteNativo({ ...evento, ...especial })).toBe(false);
  });
});
