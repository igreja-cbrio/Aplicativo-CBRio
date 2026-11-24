// ERROS DO SUPABASE AUTH EM PORTUGUÊS (24/11/2026, véspera do lançamento do app).
//
// Medido nos logs de produção: nas 24 h de 23 a 24/11, 14 cadastros pelo app
// foram recusados com "Password is known to be weak and easy to guess, please
// choose a different one." (a proteção contra senha vazada do Supabase está
// LIGADA, e deve ficar), e 4 com "User already registered". O cadastro mostrava
// `e.message` cru: a pessoa via inglês, sem saber o que fazer. Uma desistiu
// depois de 8 tentativas em 75 s.
//
// Régua PURA (sem React, sem rede): a tela passa o resultado por `t()`. Todo
// texto daqui tem tradução em lib/translations.ts (o teste cobra).

export type CodigoErroAuth =
  | "senha_fraca"
  | "ja_tem_conta"
  | "limite"
  | "email_invalido"
  | "senha_errada"
  | "email_nao_confirmado"
  | "rede"
  | "outro";

type ErroLido = { code?: unknown; status?: unknown; message?: unknown; name?: unknown };

export function codigoErroAuth(e: unknown): CodigoErroAuth {
  const err = (e && typeof e === "object" ? e : {}) as ErroLido;
  const code = typeof err.code === "string" ? err.code : "";
  const msg = typeof err.message === "string" ? err.message : typeof e === "string" ? e : "";
  const nome = typeof err.name === "string" ? err.name : "";
  if (code === "weak_password" || nome === "AuthWeakPasswordError" || /weak|easy to guess|pwned/i.test(msg)) return "senha_fraca";
  if (code === "user_already_exists" || code === "email_exists" || /already registered|already been registered/i.test(msg)) return "ja_tem_conta";
  if (err.status === 429 || code === "over_request_rate_limit" || code === "over_email_send_rate_limit" || /rate limit|too many requests/i.test(msg)) return "limite";
  if (code === "email_address_invalid" || code === "validation_failed" && /email/i.test(msg) || /invalid email|unable to validate email/i.test(msg)) return "email_invalido";
  if (code === "invalid_credentials" || /invalid login credentials/i.test(msg)) return "senha_errada";
  if (code === "email_not_confirmed" || /email not confirmed/i.test(msg)) return "email_nao_confirmado";
  if (nome === "AuthRetryableFetchError" || /network request failed|failed to fetch|network error/i.test(msg)) return "rede";
  return "outro";
}

export const MENSAGENS_ERRO_AUTH: Record<Exclude<CodigoErroAuth, "outro">, string> = {
  senha_fraca:
    "Essa senha é muito comum e fácil de adivinhar. Crie outra misturando letras e números (não use 123456 nem sua data de nascimento).",
  ja_tem_conta: "Já existe uma conta com este e-mail. Toque em Entrar ou em Esqueci minha senha.",
  limite: "Muitos acessos agora. Tente de novo em instantes.",
  email_invalido: "E-mail inválido.",
  senha_errada: "E-mail ou senha incorretos.",
  email_nao_confirmado: "Confirme sua conta antes de entrar.",
  rede: "Sem conexão com a internet agora. Confira a rede e tente de novo.",
};

/**
 * Chave de tradução para mostrar ao usuário. Nunca devolve a mensagem crua do
 * Supabase (inglês): o que não for reconhecido vira o `padrao` da tela.
 */
export function mensagemErroAuth(e: unknown, padrao: string): string {
  const c = codigoErroAuth(e);
  return c === "outro" ? padrao : MENSAGENS_ERRO_AUTH[c];
}
