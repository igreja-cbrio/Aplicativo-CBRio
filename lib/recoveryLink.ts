/** Só links da rota de recuperação podem autorizar este formulário. */
export function recoveryTokens(url: string | null): { access_token: string; refresh_token: string } | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "cbrio:" || parsed.username || parsed.password || parsed.port) return null;
    if (!((parsed.hostname === "redefinir-senha" && (parsed.pathname === "" || parsed.pathname === "/")) || (!parsed.hostname && parsed.pathname === "/redefinir-senha"))) return null;
    const entries = new Map<string, string>();
    for (const part of [parsed.search.slice(1), parsed.hash.slice(1)]) {
      // URLSearchParams tolera escapes quebrados; aqui eles invalidam o link.
      decodeURIComponent(part);
      for (const [key, value] of new URLSearchParams(part)) {
        if (entries.has(key)) return null;
        entries.set(key, value);
      }
    }
    if (entries.has("error") || entries.has("error_description") || entries.get("type") !== "recovery") return null;
    const access_token = entries.get("access_token"), refresh_token = entries.get("refresh_token");
    return access_token && refresh_token ? { access_token, refresh_token } : null;
  } catch { return null; }
}
