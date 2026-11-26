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
  | "senha_igual"
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
  if (code === "same_password" || /should be different from the old/i.test(msg)) return "senha_igual";
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
  senha_igual: "A nova senha precisa ser diferente da atual.",
};

/**
 * Chave de tradução para mostrar ao usuário. Nunca devolve a mensagem crua do
 * Supabase (inglês): o que não for reconhecido vira o `padrao` da tela.
 */
export function mensagemErroAuth(e: unknown, padrao: string): string {
  const c = codigoErroAuth(e);
  return c === "outro" ? padrao : MENSAGENS_ERRO_AUTH[c];
}

// ── LOGIN (26/11/2026) ───────────────────────────────────────────────────────
// No lançamento, 72 tentativas de senha no login e 1 certa: a tela mostrava o
// inglês do Supabase ("Invalid login credentials"), o erro de rede cru e o
// cancelamento da Apple como se fosse falha. Agora o login usa a mesma régua do
// cadastro, com duas diferenças:
//   1. mensagem PRÓPRIA (as que o AuthContext escreve em português para o fluxo
//      do Google e da Apple) é mostrada como está;
//   2. cancelar a janela da Apple não é erro: não mostra nada.

/** Erro com mensagem nossa, em português, pronta para ir à tela por `t()`. */
export function erroProprio(mensagem: string): Error & { propria: true } {
  const e = new Error(mensagem) as Error & { propria: true };
  e.propria = true;
  return e;
}

/** A pessoa fechou a janela do provedor (Apple devolve ERR_REQUEST_CANCELED). */
export function ehCancelamentoLogin(e: unknown): boolean {
  const code = (e && typeof e === "object" ? (e as { code?: unknown }).code : "") as unknown;
  return code === "ERR_REQUEST_CANCELED" || code === "ERR_CANCELED";
}

/**
 * Chave de tradução do erro de login, ou null quando não há o que mostrar
 * (cancelamento). Nunca devolve texto cru do provedor.
 */
export function mensagemErroLogin(e: unknown, padrao: string): string | null {
  if (ehCancelamentoLogin(e)) return null;
  const err = (e && typeof e === "object" ? e : {}) as { propria?: unknown; message?: unknown };
  if (err.propria === true && typeof err.message === "string" && err.message) return err.message;
  return mensagemErroAuth(e, padrao);
}

/** Motivo para a telemetria (enum nosso, nunca a mensagem). */
export function motivoErroLogin(e: unknown): string {
  if (ehCancelamentoLogin(e)) return "cancelou";
  const err = (e && typeof e === "object" ? e : {}) as { propria?: unknown };
  if (err.propria === true) return "provedor";
  return codigoErroAuth(e);
}
