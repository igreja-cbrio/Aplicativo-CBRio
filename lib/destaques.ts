import { supabase } from "./supabase";

export type Destaque = {
  id: string;
  titulo: string | null;
  subtitulo: string | null;
  imagem_url: string;
  link: string | null;
  ordem: number;
};

/** Destaques vigentes pra carrossel da home. */
export async function destaquesAtivos(): Promise<Destaque[]> {
  const { data } = await supabase
    .from("app_destaques")
    .select("id, titulo, subtitulo, imagem_url, link, ordem")
    .order("ordem", { ascending: true })
    .limit(8);
  return (data as Destaque[]) ?? [];
}
