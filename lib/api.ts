// Cliente HTTP da API CBRio (cbrio.org/api).
//
// Cuida de:
//  - base URL fixa
//  - JWT do Supabase no header Authorization (membro logado)
//  - parse de erro JSON em mensagem amigável
//
// Use api.get / api.post sempre que precisar falar com o backend.

import { supabase } from "./supabase";

const BASE = "https://cbrio.org/api";

async function authHeaders(): Promise<Record<string, string>> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error("Sessão expirada. Faça login novamente.");
  return { Authorization: `Bearer ${token}` };
}

async function parseErro(resp: Response): Promise<string> {
  try {
    const j = await resp.json();
    return (j.error || j.message || `Erro ${resp.status}`) as string;
  } catch {
    return `Erro ${resp.status}`;
  }
}

export async function apiGet<T>(path: string, opts?: { auth?: boolean }): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (opts?.auth !== false) Object.assign(headers, await authHeaders());
  const resp = await fetch(`${BASE}${path}`, { headers });
  if (!resp.ok) throw new Error(await parseErro(resp));
  return resp.json();
}

export async function apiPost<T>(
  path: string,
  body: unknown,
  opts?: { auth?: boolean }
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (opts?.auth !== false) Object.assign(headers, await authHeaders());
  const resp = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    const err = new Error(await parseErro(resp)) as Error & { status?: number };
    err.status = resp.status;
    throw err;
  }
  return resp.json().catch(() => ({}) as T);
}

// ===== Tipos do form de voluntariado =====
export type VoluntariadoOpcao = {
  label: string;
  area_canonica: string;
  exige_dados_menor: boolean;
  aviso_titulo: string | null;
  aviso_texto: string | null;
};

export async function getVoluntariadoOpcoes(): Promise<VoluntariadoOpcao[]> {
  // Tolera diferentes formatos: array puro, { opcoes: [...] }, { data: [...] }.
  const raw = await apiGet<unknown>("/public/voluntariado/form-opcoes", { auth: false });
  if (Array.isArray(raw)) return raw as VoluntariadoOpcao[];
  if (raw && typeof raw === "object") {
    const obj = raw as { opcoes?: unknown; data?: unknown };
    if (Array.isArray(obj.opcoes)) return obj.opcoes as VoluntariadoOpcao[];
    if (Array.isArray(obj.data)) return obj.data as VoluntariadoOpcao[];
  }
  return [];
}

// ===== POST /app/inscricoes (genérico, todos os tipos) =====
export type InscricaoVoluntariado = {
  tipo: "voluntariado";
  nome: string;
  sobrenome: string;
  nome_completo: string;
  email: string;
  telefone: string;
  cpf: string;
  nome_mae: string | null;
  areas: string[];
  membro_id: string | null;
};

export type InscricaoGrupo = {
  tipo: "grupos";
  grupo_id: string;
  membro_id: string;
  nome: string;
  telefone: string;
  email: string;
};

export type InscricaoQualquer = InscricaoVoluntariado | InscricaoGrupo | (Record<string, unknown> & { tipo: string });

export function criarInscricaoApi(body: InscricaoQualquer): Promise<{ ok: boolean; message?: string }> {
  return apiPost<{ ok: boolean; message?: string }>("/app/inscricoes", body);
}

// ===== /app/voluntariado/me (fonte da verdade do status do voluntário) =====
export type VoluntariadoStatus = "inscrito" | "enviado_ministerio" | "integrado" | string;

export type VoluntariadoMe = {
  inscricao: {
    id: string;
    status: VoluntariadoStatus;
    area: string | null;
    ministerios_interesse: string[] | null;
    integrado_em: string | null;
  } | null;
  voluntario_ativo: boolean;
  escalas?: Array<{
    id: string;
    data: string;
    papel: string | null;
    confirmado: boolean | null;
    ministerio: string | null;
  }>;
};

export async function getVoluntariadoMe(): Promise<VoluntariadoMe> {
  // Aceita resposta com ou sem envelope ({ data: {...} } ou raw)
  const raw = await apiGet<unknown>("/app/voluntariado/me");
  const obj = (raw && typeof raw === "object" && "data" in (raw as object))
    ? (raw as { data: unknown }).data
    : raw;
  return obj as VoluntariadoMe;
}
