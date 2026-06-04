import { supabase } from "./supabase";

export type EventoLista = {
  id: string;
  name: string;
  date: string;
  location: string | null;
  status: string | null;
  description: string | null;
  categoria: string | null;
};

/** Próximos eventos do calendário (events). */
export async function proximosEventos(limit = 50): Promise<EventoLista[]> {
  const hoje = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from("events")
    .select(
      "id, name, date, location, status, description, event_categories(name)"
    )
    .gte("date", hoje)
    .order("date", { ascending: true })
    .limit(limit);
  if (error) {
    console.log("[eventos] erro:", error.message);
    return [];
  }
  type Row = {
    id: string;
    name: string;
    date: string;
    location: string | null;
    status: string | null;
    description: string | null;
    event_categories?: { name: string | null } | { name: string | null }[] | null;
  };
  return (data as Row[] | null)?.map((e) => {
    const cat = Array.isArray(e.event_categories)
      ? e.event_categories[0]?.name ?? null
      : e.event_categories?.name ?? null;
    return {
      id: e.id,
      name: e.name,
      date: e.date,
      location: e.location,
      status: e.status,
      description: e.description,
      categoria: cat,
    };
  }) ?? [];
}

const MESES = [
  "jan", "fev", "mar", "abr", "mai", "jun",
  "jul", "ago", "set", "out", "nov", "dez",
];

export function formatEventoData(iso: string): { dia: string; mes: string } {
  const d = new Date(iso + "T12:00:00");
  return {
    dia: String(d.getDate()).padStart(2, "0"),
    mes: MESES[d.getMonth()],
  };
}
