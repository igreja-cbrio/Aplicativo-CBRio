import { supabase } from './supabase';

const BASE         = process.env.EXPO_PUBLIC_API_URL          ?? 'https://crmcbrio.vercel.app/api';
const YT_KEY       = process.env.EXPO_PUBLIC_YOUTUBE_API_KEY  ?? '';
const YT_CHANNEL   = process.env.EXPO_PUBLIC_YOUTUBE_CHANNEL_ID ?? '';
const YT_API       = 'https://www.googleapis.com/youtube/v3';

async function authHeaders() {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function get<T>(path: string): Promise<T> {
  const r = await fetch(`${BASE}${path}`, { headers: await authHeaders() });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

async function post<T>(path: string, body: object): Promise<T> {
  const r = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

async function put<T>(path: string, body: object): Promise<T> {
  const r = await fetch(`${BASE}${path}`, {
    method: 'PUT',
    headers: await authHeaders(),
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

// ── Cultos ────────────────────────────────────────────────────────────────────
export const cultos = {
  serviceTypes: () => get<any[]>('/kpis/service-types'),
  checkin: (body: { service_type_id: string; data: string; membro_id?: string }) =>
    post('/app/checkin', body),
};

// ── Visitante ─────────────────────────────────────────────────────────────────
export const visitante = {
  cadastrar: (body: {
    nome: string; telefone: string; email?: string;
    como_conheceu?: string; service_type_id?: string;
  }) => post('/app/visitante', body),
};

// ── Grupos ────────────────────────────────────────────────────────────────────
export const grupos = {
  list:      () => get<any[]>('/app/grupos'),
  meusGrupos:() => get<any[]>('/app/membro/grupos'),
};

// ── Membro ────────────────────────────────────────────────────────────────────
export const membro = {
  perfil:   () => get<any>('/app/membro/perfil'),
  atualizar: (body: object) => put<any>('/app/membro/perfil', body),
  vincular: (body: { cpf: string; data_nascimento: string; email: string }) =>
    post<{ token: string }>('/app/membro/vincular', body),
};

// ── Voluntariado ──────────────────────────────────────────────────────────────
export const voluntariado = {
  status: (userId: string) => get<{ voluntario: boolean; area?: string; funcao?: string }>(`/app/voluntariado/status/${userId}`),
  escalas: () => get<any[]>('/app/voluntariado/escalas'),
};

// ── Inscrições ────────────────────────────────────────────────────────────────
export const inscricoes = {
  list:     () => get<any[]>('/app/inscricoes'),
  inscrever:(tipo: string, dados: object) => post('/app/inscricoes', { tipo, ...dados }),
};

// ── Anúncios ──────────────────────────────────────────────────────────────────
export const anuncios = {
  list: () => get<any[]>('/app/anuncios'),
};

// ── YouTube ───────────────────────────────────────────────────────────────────
function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}

export const youtube = {
  cultos: async () => {
    if (!YT_KEY || !YT_CHANNEL) return [];
    const url = `${YT_API}/search?part=snippet&channelId=${YT_CHANNEL}&type=video&order=date&maxResults=50&key=${YT_KEY}`;
    const r = await fetch(url);
    if (!r.ok) throw new Error('YouTube API error');
    const data = await r.json();
    return (data.items || []).map((item: any) => ({
      id:        item.id.videoId,
      titulo:    item.snippet.title,
      descricao: item.snippet.description,
      data:      formatDate(item.snippet.publishedAt),
      thumbnail: item.snippet.thumbnails?.medium?.url || '',
      url:       `https://www.youtube.com/watch?v=${item.id.videoId}`,
    }));
  },

  live: async (): Promise<string | null> => {
    if (!YT_KEY || !YT_CHANNEL) return null;
    const url = `${YT_API}/search?part=snippet&channelId=${YT_CHANNEL}&type=video&eventType=live&key=${YT_KEY}`;
    const r = await fetch(url);
    if (!r.ok) return null;
    const data = await r.json();
    const item = data.items?.[0];
    return item ? `https://www.youtube.com/watch?v=${item.id.videoId}` : null;
  },

  pense: async () => {
    if (!YT_KEY || !YT_CHANNEL) return [];
    const url = `${YT_API}/search?part=snippet&channelId=${YT_CHANNEL}&type=video&q=pense&order=date&maxResults=30&key=${YT_KEY}`;
    const r = await fetch(url);
    if (!r.ok) return [];
    const data = await r.json();
    return (data.items || []).map((item: any) => ({
      id:     item.id.videoId,
      titulo: item.snippet.title,
      data:   formatDate(item.snippet.publishedAt),
      url:    `https://www.youtube.com/watch?v=${item.id.videoId}`,
    }));
  },
};
