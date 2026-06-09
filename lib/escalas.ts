import { supabase } from "./supabase";

export type MinhaEscala = {
  id: string;
  service_id: string | null;
  team_name: string | null;
  position_name: string | null;
  confirmation_status: string | null;
  data: string | null;        // ISO date
  culto: string | null;
};

/**
 * Escalas do voluntário (vol_schedules) cruzando com vol_services pra
 * pegar nome do culto + data. Apenas futuras (>= hoje) ordenadas
 * crescente.
 */
export async function minhasEscalas(volProfileId: string, limit = 50): Promise<MinhaEscala[]> {
  const hoje = new Date().toISOString();
  const { data } = await supabase
    .from("vol_schedules")
    .select(
      "id, service_id, team_name, position_name, confirmation_status, " +
        "vol_services(name, service_type_name, scheduled_at)"
    )
    .eq("volunteer_id", volProfileId)
    .order("created_at", { ascending: false })
    .limit(limit);

  type Row = {
    id: string;
    service_id: string | null;
    team_name: string | null;
    position_name: string | null;
    confirmation_status: string | null;
    vol_services?:
      | { name: string | null; service_type_name: string | null; scheduled_at: string | null }
      | { name: string | null; service_type_name: string | null; scheduled_at: string | null }[]
      | null;
  };

  const rows = (data as Row[] | null) ?? [];
  return rows
    .map((r) => {
      const svc = Array.isArray(r.vol_services) ? r.vol_services[0] : r.vol_services;
      return {
        id: r.id,
        service_id: r.service_id,
        team_name: r.team_name,
        position_name: r.position_name,
        confirmation_status: r.confirmation_status,
        data: (svc?.scheduled_at as string | null) ?? null,
        culto: (svc?.name as string | null) ?? (svc?.service_type_name as string | null) ?? null,
      };
    })
    .filter((r) => !r.data || r.data >= hoje)
    .sort((a, b) => {
      if (!a.data) return 1;
      if (!b.data) return -1;
      return a.data.localeCompare(b.data);
    });
}
