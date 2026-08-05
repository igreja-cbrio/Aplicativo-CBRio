// ============================================================================
// PAYLOAD DE INSCRIÇÃO · o contrato do lado do app (05/08/2026)
//
// O corpo que o app manda pro `POST /app/eventos/:id/inscrever` é o MESMO do
// formulário público — o servidor roda `inscreverEspinha`, a mesma função, com
// `validarCamposPadrao` exigindo nome completo, telefone, e-mail, CPF (com DV),
// nascimento e SEXO.
//
// ⚠️ Isto vive em `lib/` (não dentro da tela) por um motivo: é a régua que mais
// silenciosamente quebra. Faltar um campo aqui não dá erro de TypeScript — dá
// 400 do servidor na cara da pessoa, depois de ela preencher tudo. O teste
// `test/inscricaoPayload.test.ts` trava a lista.
// ============================================================================
import type { MembroFicha } from "./ficha";

export type PayloadInscricao = {
  nome_completo: string;
  telefone: string;
  cpf: string;
  email: string;
  data_nascimento: string;
  sexo: string;
  dados: Record<string, string>;
  aceita_termos: true;
  whatsapp_optin: boolean;
};

/**
 * Monta o corpo da inscrição a partir da ficha do cadastro + campos EXTRA.
 * ⚠️ `aceita_termos` é SEMPRE true aqui porque a tela só chama isto depois de a
 * pessoa marcar — quem guarda a prova é o servidor (`inscricao_consentimentos`,
 * com snapshot do texto que o servidor mandou). O app nunca inventa o texto.
 */
export function montarPayloadInscricao(
  membro: MembroFicha,
  extras: Record<string, string> = {},
  optin = false
): PayloadInscricao {
  return {
    nome_completo: (membro.nome || "").trim(),
    telefone: String(membro.telefone || "").replace(/\D/g, ""),
    cpf: String(membro.cpf || "").replace(/\D/g, ""),
    email: (membro.email || "").trim(),
    data_nascimento: membro.dataNascimento || "",
    sexo: membro.genero || "",
    // Só o que a pessoa realmente respondeu (vazio não vira resposta em branco).
    dados: Object.fromEntries(
      Object.entries(extras).filter(([, v]) => String(v ?? "").trim() !== "")
    ),
    aceita_termos: true,
    whatsapp_optin: !!optin,
  };
}

/**
 * Campos EXTRA obrigatórios que ficaram em branco (evita ida-e-volta ao
 * servidor). ⚠️ NÃO substitui a validação de lá — `validarExtras` refaz.
 */
export function extrasFaltando(
  campos: { key: string; label: string; obrigatorio?: boolean }[] | null | undefined,
  extras: Record<string, string>
): string | null {
  const f = (campos || []).find(
    (c) => c.obrigatorio && !String(extras[c.key] ?? "").trim()
  );
  return f ? f.label : null;
}
