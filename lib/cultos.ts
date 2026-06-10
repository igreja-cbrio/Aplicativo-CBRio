import { supabase } from "./supabase";
import { cacheSWR } from "./cache";

export type CultoUpcoming = {
  id: string;
  nome: string | null;
  data: string;     // ISO date
  hora: string;     // HH:MM:SS
  cor: string | null;
  has_online: boolean | null;
  has_kids: boolean | null;
};

async function buscarProximosCultos(diasFrente: number): Promise<CultoUpcoming[]> {
  const hoje = new Date();
  const limite = new Date(hoje);
  limite.setDate(limite.getDate() + diasFrente);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from("cultos")
    .select("id, nome, data, hora, vol_service_types(color, has_online_stream, has_kids)")
    .gte("data", fmt(hoje))
    .lte("data", fmt(limite))
    .is("deleted_at", null)
    .order("data", { ascending: true })
    .order("hora", { ascending: true });
  if (error) throw error;
  type Row = {
    id: string;
    nome: string | null;
    data: string;
    hora: string;
    vol_service_types?:
      | { color: string | null; has_online_stream: boolean | null; has_kids: boolean | null }
      | { color: string | null; has_online_stream: boolean | null; has_kids: boolean | null }[]
      | null;
  };
  return ((data as Row[] | null) ?? []).map((r) => {
    const st = Array.isArray(r.vol_service_types) ? r.vol_service_types[0] : r.vol_service_types;
    return {
      id: r.id,
      nome: r.nome,
      data: r.data,
      hora: r.hora,
      cor: st?.color ?? null,
      has_online: st?.has_online_stream ?? null,
      has_kids: st?.has_kids ?? null,
    };
  });
}

/**
 * Cultos a partir de hoje (até 7 dias por padrão), ordenados. Iguais
 * entre usuários -> cache local (SWR, TTL 10 min). A chave inclui a data
 * de hoje, então o cache vira sozinho de um dia pro outro. `forcar`
 * ignora o cache (pull-to-refresh).
 */
export async function proximosCultos(
  diasFrente = 7,
  forcar = false
): Promise<CultoUpcoming[]> {
  const hojeKey = new Date().toISOString().slice(0, 10);
  return cacheSWR(
    `cultos:${diasFrente}:${hojeKey}`,
    () => buscarProximosCultos(diasFrente),
    { forcar }
  );
}

const DOW = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export function formatCultoDia(iso: string): string {
  const d = new Date(iso + "T12:00:00");
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const alvo = new Date(d);
  alvo.setHours(0, 0, 0, 0);
  const diff = Math.round((alvo.getTime() - hoje.getTime()) / 86400000);
  if (diff === 0) return "Hoje";
  if (diff === 1) return "Amanhã";
  return `${DOW[d.getDay()]} ${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function formatCultoHora(hhmmss: string): string {
  return hhmmss.slice(0, 5);
}

export type CultoDetalhe = {
  id: string;
  nome: string | null;
  data: string;
  hora: string;
  youtube_video_id: string | null;
  service_type: {
    name: string | null;
    description: string | null;
    has_online_stream: boolean | null;
    has_kids: boolean | null;
    color: string | null;
  } | null;
};

export async function getCulto(id: string): Promise<CultoDetalhe | null> {
  const { data } = await supabase
    .from("cultos")
    .select(
      "id, nome, data, hora, youtube_video_id, vol_service_types(name, description, has_online_stream, has_kids, color)"
    )
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;
  const raw = data as unknown as {
    id: string;
    nome: string | null;
    data: string;
    hora: string;
    youtube_video_id: string | null;
    vol_service_types?: CultoDetalhe["service_type"] | CultoDetalhe["service_type"][] | null;
  };
  const st = Array.isArray(raw.vol_service_types)
    ? raw.vol_service_types[0] ?? null
    : raw.vol_service_types ?? null;
  return {
    id: raw.id,
    nome: raw.nome,
    data: raw.data,
    hora: raw.hora,
    youtube_video_id: raw.youtube_video_id,
    service_type: st,
  };
}

const DOW_LONG = [
  "Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira",
  "Quinta-feira", "Sexta-feira", "Sábado",
];

const MESES_LONG = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

export function formatDataLonga(iso: string): string {
  const d = new Date(iso + "T12:00:00");
  return `${DOW_LONG[d.getDay()]}, ${d.getDate()} de ${MESES_LONG[d.getMonth()]} de ${d.getFullYear()}`;
}
