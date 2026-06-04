import { supabase } from "./supabase";

export type Indisponibilidade = {
  id: string;
  unavailable_from: string;   // ISO date
  unavailable_to: string;     // ISO date
  reason: string | null;
};

/** Encontra o vol_profile do usuário pelo auth_user_id (preferido) ou membresia_id. */
export async function getMeuVolProfileId(
  authUserId: string,
  membroId: string | null
): Promise<string | null> {
  const { data: p1 } = await supabase
    .from("vol_profiles")
    .select("id")
    .eq("auth_user_id", authUserId)
    .maybeSingle();
  if (p1?.id) return p1.id as string;

  if (membroId) {
    const { data: p2 } = await supabase
      .from("vol_profiles")
      .select("id")
      .eq("membresia_id", membroId)
      .maybeSingle();
    if (p2?.id) return p2.id as string;
  }
  return null;
}

/** Lista as janelas de indisponibilidade do voluntário (futuras e atuais). */
export async function listarIndisponibilidades(
  volProfileId: string
): Promise<Indisponibilidade[]> {
  const hoje = new Date().toISOString().slice(0, 10);
  const { data } = await supabase
    .from("vol_availability")
    .select("id, unavailable_from, unavailable_to, reason")
    .eq("volunteer_profile_id", volProfileId)
    .gte("unavailable_to", hoje)
    .order("unavailable_from", { ascending: true });
  return (data as Indisponibilidade[]) ?? [];
}

export async function adicionarIndisponibilidade(
  volProfileId: string,
  from: string,
  to: string,
  reason: string | null
): Promise<void> {
  const { error } = await supabase.from("vol_availability").insert({
    volunteer_profile_id: volProfileId,
    unavailable_from: from,
    unavailable_to: to,
    reason: reason?.trim() || null,
  });
  if (error) throw error;
}

export async function removerIndisponibilidade(id: string): Promise<void> {
  const { error } = await supabase.from("vol_availability").delete().eq("id", id);
  if (error) throw error;
}
