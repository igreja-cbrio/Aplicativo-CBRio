// Liturgia do culto (fase 1 leitura · fase 2 edição · 25/11/2026).
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
  // Fase 2 (opcionais: API anterior não mandava).
  etapa_id?: string | null; // só no cronograma do culto; null no roteiro padrão
  e_musica?: boolean; // "Música 1", "Música Dízimo"… recebem música do catálogo
  musica?: MusicaCatalogo | null;
};

// Músicas do Louvor do culto (as mesmas do card "Músicas do culto de hoje").
export type MusicaLiturgia = {
  ordem: number;
  titulo: string;
  artista: string | null;
  tom: string | null;
  link: string | null;
};

export type Liturgia = {
  culto: { id: string; nome: string; scheduled_at: string | null };
  fonte: "culto" | "padrao" | "vazio";
  itens: ItemLiturgia[];
  total_previsto_seg: number | null;
  // `null` + `musicas_erro` = não deu pra ler; nunca confundir com "nenhuma".
  // Opcionais: API anterior a 25/11 (tarde) não mandava.
  musicas?: MusicaLiturgia[] | null;
  musicas_erro?: boolean;
  pode_editar: boolean;
  versao?: number; // trava contra salvamento cruzado com o sistema
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

// ============================================================================
// Fase 2 (25/11/2026): EDITAR a liturgia pelo app. Grava no MESMO cronograma
// que a Produção edita no sistema (`/producao`), então o que muda aqui aparece
// lá e vice-versa. Quem pode editar e o que vale decide o servidor
// (`pode_editar`, escrita 2+ na Produção); aqui só o rascunho da tela.
// O app nunca manda o executado: o servidor o preserva pela `etapa_id`.
// ============================================================================

export type MusicaCatalogo = {
  id: string;
  titulo: string;
  artista: string | null;
  tom: string | null;
  link: string | null;
  duracao_seg?: number | null; // do arranjo do Planning Center
  // Letra e cifra (o "preview" do PCO): só vêm nas músicas da liturgia do culto.
  letra?: string | null;
  cifra?: string | null;
  // PDFs (cifra/letra) que vivem no Planning Center: só a lista; abrir pede ao
  // servidor uma URL temporária (`rotaAbrirAnexo`).
  anexos?: AnexoMusica[];
};

export type AnexoMusica = { id: string; nome: string; tipo: string | null };

export const ROTA_CATALOGO_MUSICAS = "/app/voluntariado/liturgia-musicas";

export type RascunhoItem = {
  chave: string; // estável na tela (etapa_id ou índice do roteiro padrão)
  etapa_id: string | null;
  titulo: string;
  secao: "culto" | "pos_culto";
  previsto: string; // "mm:ss" como a pessoa digita
  e_musica: boolean;
  musica: MusicaCatalogo | null;
};

// 330 → "5:30" · null → "".
export function segParaMMSS(seg: number | null | undefined): string {
  if (seg == null || !Number.isFinite(seg) || seg < 0) return "";
  const total = Math.round(seg);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

// "5:30" → 330 · "5" → 300 (minutos) · "" → null · lixo → NaN (a tela recusa).
export function mmssParaSeg(txt: string): number | null {
  const s = String(txt || "").trim();
  if (!s) return null;
  const m = /^(\d{1,3})(?::(\d{1,2}))?$/.exec(s);
  if (!m) return NaN;
  const seg = m[2] === undefined ? 0 : Number(m[2]);
  if (seg > 59) return NaN;
  return Number(m[1]) * 60 + seg;
}

export function rascunhoDe(itens: ItemLiturgia[]): RascunhoItem[] {
  return itens.map((it, i) => ({
    chave: it.etapa_id ?? `padrao-${i}`,
    etapa_id: it.etapa_id ?? null,
    titulo: it.titulo,
    secao: it.secao === "pos_culto" ? "pos_culto" : "culto",
    previsto: segParaMMSS(it.previsto_seg),
    e_musica: it.e_musica === true,
    musica: it.musica ?? null,
  }));
}

// Move um momento uma posição para cima (-1) ou para baixo (+1), sem cruzar a
// fronteira culto/pós-culto. Fora disso devolve a MESMA lista.
export function moverItem(lista: RascunhoItem[], chave: string, direcao: -1 | 1): RascunhoItem[] {
  const i = lista.findIndex((x) => x.chave === chave);
  const j = i + direcao;
  if (i < 0 || j < 0 || j >= lista.length || lista[i].secao !== lista[j].secao) return lista;
  const copia = lista.slice();
  [copia[i], copia[j]] = [copia[j], copia[i]];
  return copia;
}

export type ItemParaSalvar = {
  etapa_id: string | null;
  titulo: string;
  previsto_seg: number | null;
  secao: "culto" | "pos_culto";
  musica_id: string | null;
};

// Corpo do PUT. Tempo ilegível vira erro com o nome do momento (nada é enviado).
export function itensParaSalvar(lista: RascunhoItem[]): { itens: ItemParaSalvar[] } | { erro: string } {
  const ordenada = [...lista.filter((x) => x.secao !== "pos_culto"), ...lista.filter((x) => x.secao === "pos_culto")];
  const itens: ItemParaSalvar[] = [];
  for (const x of ordenada) {
    const seg = mmssParaSeg(x.previsto);
    if (seg !== null && !Number.isFinite(seg)) return { erro: x.titulo };
    itens.push({ etapa_id: x.etapa_id, titulo: x.titulo, previsto_seg: seg, secao: x.secao, musica_id: x.musica?.id ?? null });
  }
  return { itens };
}

export function rotuloMusica(m: MusicaCatalogo | null | undefined): string {
  if (!m) return "";
  return [m.titulo, m.artista, m.tom].filter(Boolean).join(" · ");
}

// Ao escolher uma música, o previsto VAZIO ganha a duração dela (o que já foi
// digitado nunca é trocado).
export function previstoAoEscolher(previstoAtual: string, musica: MusicaCatalogo | null): string {
  if (String(previstoAtual || "").trim()) return previstoAtual;
  return musica?.duracao_seg ? segParaMMSS(musica.duracao_seg) : previstoAtual;
}

export function rotaAbrirAnexo(serviceId: string, anexoId: string): string {
  return `${rotaLiturgia(serviceId)}/anexos/${encodeURIComponent(anexoId)}/abrir`;
}

// "Cifra G.pdf" → "Cifra G". Nome vazio vira "Arquivo".
export function nomeAnexo(nome: string | null | undefined): string {
  const n = String(nome || "").trim().replace(/\.(pdf|png|jpe?g|gif|webp)$/i, "").trim();
  return n || "Arquivo";
}
