// Liturgia do culto (fase 1 · só leitura · 25/11/2026).
// O servidor decide quem vê e monta a lista (rota
// `/app/voluntariado/liturgia/:serviceId`, régua `utils/liturgiaCulto.js` no
// sistema). Aqui só tipos e formatação, para a tela não fazer conta de fuso.

export type ItemLiturgia = {
  ordem: number;
  titulo: string;
  secao: "culto" | "pos_culto";
  previsto_seg: number | null;
  inicio: string | null; // ISO
  observacao: string | null;
  especial: boolean;
};

export type Liturgia = {
  culto: { id: string; nome: string; scheduled_at: string | null };
  fonte: "culto" | "padrao" | "vazio";
  itens: ItemLiturgia[];
  total_previsto_seg: number | null;
  pode_editar: boolean;
};

export function rotaLiturgia(serviceId: string): string {
  return `/app/voluntariado/liturgia/${encodeURIComponent(serviceId)}`;
}

// "19:05" em Brasília (UTC-3 fixo, sem horário de verão — mesma régua do servidor).
export function horaBRT(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return null;
  const d = new Date(t - 3 * 3600 * 1000);
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}

// 300 → "5 min" · 330 → "5min30" · 3900 → "1h05". Nulo/negativo → null.
export function duracaoCurta(seg: number | null | undefined): string | null {
  if (seg == null || !Number.isFinite(seg) || seg < 0) return null;
  const total = Math.round(seg);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}h${String(m).padStart(2, "0")}`;
  if (s > 0) return `${m}min${String(s).padStart(2, "0")}`;
  return `${m} min`;
}

// Separa os momentos do culto dos de pós-culto, mantendo a ordem do servidor.
export function dividirSecoes(itens: ItemLiturgia[]): { culto: ItemLiturgia[]; posCulto: ItemLiturgia[] } {
  return {
    culto: itens.filter((i) => i.secao !== "pos_culto"),
    posCulto: itens.filter((i) => i.secao === "pos_culto"),
  };
}
