/**
 * Mensagem legível de qualquer erro: `Error`, erro do PostgREST (objeto plano
 * com `message`/`code`/`details` — NÃO é instância de Error, então
 * `String(e)` virava "[object Object]" na telemetria de 24/09/2026) ou string.
 * PURO, sem react-native: entra no portão.
 */
export function mensagemDoErro(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (e && typeof e === "object") {
    const o = e as { message?: unknown; code?: unknown; details?: unknown };
    const partes = [o.code, o.message, o.details].filter((p): p is string => typeof p === "string" && p.length > 0);
    if (partes.length) return partes.join(" · ");
    try { return JSON.stringify(e); } catch { /* segue */ }
  }
  return String(e);
}
