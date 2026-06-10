import { supabase } from "./supabase";
import { cacheSWR } from "./cache";

export type Destaque = {
  id: string;
  titulo: string | null;
  subtitulo: string | null;
  imagem_url: string;
  link: string | null;
  ordem: number;
};

async function buscarDestaques(): Promise<Destaque[]> {
  const { data, error } = await supabase
    .from("app_destaques")
    .select("id, titulo, subtitulo, imagem_url, link, ordem")
    .order("ordem", { ascending: true })
    .limit(8);
  if (error) throw error;
  return (data as Destaque[]) ?? [];
}

/**
 * Destaques vigentes pra carrossel da home. Dados iguais entre usuários,
 * então usa cache local (SWR, TTL 10 min). `forcar` ignora o cache
 * (pull-to-refresh).
 */
export async function destaquesAtivos(forcar = false): Promise<Destaque[]> {
  return cacheSWR("destaques", buscarDestaques, { forcar });
}
