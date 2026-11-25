export type MusicaLouvor = { id: string; titulo: string; artista: string | null; tom: string | null; link: string | null; ordem: number };
export type CultoLouvor = { id: string; name: string | null; service_type_name: string | null; scheduled_at: string; pode_editar: boolean; musicas: MusicaLouvor[] };
export type RepertorioLouvor = { acesso: boolean; cultos: CultoLouvor[] };
export function linkMusicaSeguro(link: string | null): string | null {
  if (!link) return null;
  try {
    const url = new URL(link);
    return ['http:', 'https:'].includes(url.protocol) && !!url.hostname && !url.username && !url.password ? link : null;
  } catch { return null; }
}
