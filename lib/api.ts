// Cliente HTTP da API CBRio (cbrio.org/api).
//
// Cuida de:
//  - base URL fixa
//  - JWT do Supabase no header Authorization (membro logado)
//  - parse de erro JSON em mensagem amigável
//
// Use api.get / api.post sempre que precisar falar com o backend.

import { supabase } from "./supabase";

// Usar `www.` direto: cbrio.org -> www.cbrio.org redireciona 307 e
// alguns clients dropam o header Authorization na hora de seguir.
const BASE = "https://www.cbrio.org/api";

async function authHeaders(): Promise<Record<string, string>> {
  let {
    data: { session },
  } = await supabase.auth.getSession();
  // Renova proativamente se o token expirou (ou expira em <60s). O backend
  // valida o JWT via getUser; um access_token vencido vira 401 "Token inválido"
  // (sintoma: telas que batem no backend — Kids, Avisos, Meu grupo — quebram,
  // enquanto as que usam o supabase direto seguem funcionando). O auto-refresh
  // pode não ter rodado se o app ficou em background, então forçamos aqui.
  const expMs = session?.expires_at ? session.expires_at * 1000 : 0;
  if (session && expMs && expMs < Date.now() + 60_000) {
    const { data, error } = await supabase.auth.refreshSession();
    if (!error && data.session) {
      session = data.session;
    } else if (expMs < Date.now()) {
      // Token JÁ vencido e o refresh falhou (sem rede / servidor fora): a
      // chamada morreria num 401 "Token inválido" enganoso. Erro honesto —
      // é conexão, não sessão; resolve sozinho quando a rede voltar.
      throw new Error("Não foi possível conectar. Verifique sua internet e tente novamente.");
    }
  }
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

// ===== /app/next (NEXT) =====
export type NextEncontro = {
  id: string;
  data: string;             // ISO date
  titulo: string;
  inscrito: boolean;
  check_in_at: string | null;
  pode_checkin_hoje: boolean;
};

export type NextMe = {
  inscrito_next: boolean;
  encontros: NextEncontro[];
  igreja: { lat: number; lng: number; raio_m: number } | null;
};

export async function getNextMe(): Promise<NextMe> {
  const raw = await apiGet<unknown>("/app/next/me");
  const obj = (raw && typeof raw === "object" && "data" in (raw as object))
    ? (raw as { data: unknown }).data
    : raw;
  return obj as NextMe;
}

export type NextInscreverResp = {
  ok: boolean;
  jaInscrito?: boolean;
  evento?: NextEncontro;
};

export function inscreverNext(): Promise<NextInscreverResp> {
  return apiPost<NextInscreverResp>("/app/next/inscrever", {});
}

export type NextCheckinErro = {
  ok: false;
  error: string;
  distancia_m?: number;
  needLocation?: boolean;
  status: number;
};

export type NextCheckinResp =
  | { ok: true; check_in_at: string }
  | NextCheckinErro;

export async function checkinNext(
  eventoId: string,
  lat: number,
  lng: number
): Promise<NextCheckinResp> {
  try {
    const data = await apiPost<{ ok: boolean; check_in_at: string }>(
      `/app/next/encontros/${encodeURIComponent(eventoId)}/checkin`,
      { lat, lng }
    );
    return { ok: true, check_in_at: data.check_in_at };
  } catch (e) {
    const err = e as Error & { status?: number; raw?: unknown };
    // apiPost lança Error com .status; o body veio em .message OU como JSON.
    // O backend devolve { error, distancia_m?, needLocation? } — tenta extrair.
    let body: Record<string, unknown> = {};
    try {
      body = JSON.parse(err.message) as Record<string, unknown>;
    } catch {
      body = { error: err.message };
    }
    return {
      ok: false,
      error: (body.error as string) ?? err.message ?? "Falha no check-in.",
      distancia_m: typeof body.distancia_m === "number" ? body.distancia_m : undefined,
      needLocation: body.needLocation === true,
      status: err.status ?? 500,
    } as NextCheckinErro;
  }
}
