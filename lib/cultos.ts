import { captureCampusSession } from "./campusSession";
import { cacheSWR } from "./cache";
import { apiGet } from "./api";
import { hojeBRT } from "./dataBRT";

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
  return apiGet<CultoUpcoming[]>(`/app/campus/agenda?dias=${encodeURIComponent(diasFrente)}`);
}

/**
 * Cultos a partir de hoje (até 7 dias por padrão), ordenados. O cache local
 * (SWR, TTL 10 min) inclui usuário, campus e data em BRT; nunca reutiliza
 * a agenda de outra unidade ou conta. `forcar`
 * ignora o cache (pull-to-refresh).
 */
export async function proximosCultos(
  diasFrente = 7,
  forcar = false
): Promise<CultoUpcoming[]> {
  // Mesma régua da query (BRT): chave em UTC virava 3h antes e o cache pedia
  // uma janela diferente da que a query usa.
  const scope = captureCampusSession();
  try {
    if (!scope.userId || !scope.campusId) throw new Error('Escolha o campus para consultar a agenda.');
    const resultado = await cacheSWR(
      `cultos:${scope.cacheKey}:${diasFrente}:${hojeBRT()}`,
      async () => { scope.assertCurrent(); return buscarProximosCultos(diasFrente); },
      { forcar }
    );
    scope.assertCurrent();
    return resultado;
  } finally { scope.release(); }
}

export type CultoAoVivo = {
  culto: { id: string; nome: string; data: string; hora: string | null } | null;
  ao_vivo: boolean;
  canal_live: string;
  jaRegistrou: boolean;
};

/**
 * "Tem culto acontecendo AGORA?" — quem decide é o servidor
 * (`GET /app/culto/agora`), que resolve o dia em BRT e a janela do culto.
 *
 * ⚠️ Sem cache de propósito: é o dado mais perecível da Home. Servir do cache
 * mostraria "estamos ao vivo" depois do culto acabar.
 * ⚠️ `ao_vivo` chegou em 04/08/2026. Build/OTA antigo contra backend novo
 * ignora o campo (não usa); app novo contra backend antigo recebe `undefined`
 * e simplesmente não mostra o card — nunca mostra por engano.
 */
export async function cultoAoVivo(): Promise<CultoAoVivo | null> {
  try {
    return await apiGet<CultoAoVivo>("/app/culto/agora");
  } catch {
    return null;
  }
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
  return apiGet<CultoDetalhe | null>(`/app/campus/agenda/${encodeURIComponent(id)}`);
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
