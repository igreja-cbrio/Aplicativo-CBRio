import { supabase } from "./supabase";

const API = "https://cbrio.org/api";

async function authHeader() {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error("Sessão expirada. Faça login novamente.");
  return { Authorization: `Bearer ${token}` };
}

/** GET /api/grupos/meu — grupos que participo/lidero + meus pedidos pendentes. */
export async function meusGrupos() {
  const resp = await fetch(`${API}/grupos/meu`, { headers: await authHeader() });
  if (!resp.ok) throw new Error("Não foi possível carregar seus grupos.");
  return resp.json();
}

/**
 * Pedido para entrar em um grupo. NÃO pode ser insert direto (RLS bloqueia) —
 * vai pelo backend, autenticado com o token do Supabase do membro.
 * O backend força status='pendente', deduplica (409) e notifica o líder.
 */
export async function pedirEntrarGrupo(
  grupoId: string,
  body: { membro_id: string; nome: string; telefone?: string | null; email?: string | null; observacao?: string | null }
) {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error("Sessão expirada. Faça login novamente.");

  const resp = await fetch(`${API}/grupos/${grupoId}/pedidos`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ ...body, origem: "app" }),
  });

  if (resp.status === 409) {
    const e = new Error("Você já tem um pedido neste grupo ou já participa.") as Error & { code?: number };
    e.code = 409;
    throw e;
  }
  if (!resp.ok) {
    let msg = "Não foi possível enviar o pedido.";
    try {
      const j = await resp.json();
      msg = j.error || j.message || msg;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
  return resp.json().catch(() => ({}));
}
