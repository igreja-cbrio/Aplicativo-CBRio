import { supabase } from "./supabase";

export type CultoUpcoming = {
  id: string;
  nome: string | null;
  data: string;     // ISO date
  hora: string;     // HH:MM:SS
};

/** Cultos a partir de hoje (até 7 dias por padrão), ordenados. */
export async function proximosCultos(diasFrente = 7): Promise<CultoUpcoming[]> {
  const hoje = new Date();
  const limite = new Date(hoje);
  limite.setDate(limite.getDate() + diasFrente);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const { data } = await supabase
    .from("cultos")
    .select("id, nome, data, hora")
    .gte("data", fmt(hoje))
    .lte("data", fmt(limite))
    .is("deleted_at", null)
    .order("data", { ascending: true })
    .order("hora", { ascending: true });
  return (data as CultoUpcoming[]) ?? [];
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
