import { supabase } from './supabase';

const BASE = process.env.EXPO_PUBLIC_API_URL ?? 'https://crmcbrio.vercel.app/api';

async function authHeaders() {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function get<T>(path: string): Promise<T> {
  const r = await fetch(`${BASE}${path}`, { headers: await authHeaders() });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

async function post<T>(path: string, body: object): Promise<T> {
  const r = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

// ── Cultos ────────────────────────────────────────────────────────────────────
export const cultos = {
  serviceTypes: () => get<any[]>('/kpis/service-types'),
  checkin: (body: { service_type_id: string; data: string; membro_id?: string }) =>
    post('/app/checkin', body),
};

// ── Visitante ─────────────────────────────────────────────────────────────────
export const visitante = {
  cadastrar: (body: {
    nome: string; telefone: string; email?: string;
    como_conheceu?: string; service_type_id?: string;
  }) => post('/app/visitante', body),
};

// ── Grupos ────────────────────────────────────────────────────────────────────
export const grupos = {
  list: () => get<any[]>('/app/grupos'),
};

// ── Membro ────────────────────────────────────────────────────────────────────
export const membro = {
  perfil: () => get<any>('/app/membro/perfil'),
};
