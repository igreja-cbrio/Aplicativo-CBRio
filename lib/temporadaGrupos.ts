import { supabase } from "./supabase";

/**
 * Temporada de inscrição em grupos. O estado (aberta/fechada) vive no
 * sistema integrado (Supabase, tabela `app_grupos_temporada`, controlada
 * pela liderança). Por padrão FECHADA — só abre quando a temporada começa.
 * O app lê e libera/bloqueia a inscrição conforme isso.
 */
export type TemporadaGrupos = { aberta: boolean; titulo: string | null };

export async function getTemporadaGrupos(): Promise<TemporadaGrupos> {
  try {
    const { data } = await supabase
      .from("app_grupos_temporada")
      .select("aberta, titulo")
      .maybeSingle();
    return { aberta: !!data?.aberta, titulo: data?.titulo ?? null };
  } catch {
    // Em caso de falha, assume FECHADA (mais seguro que liberar indevidamente).
    return { aberta: false, titulo: null };
  }
}
