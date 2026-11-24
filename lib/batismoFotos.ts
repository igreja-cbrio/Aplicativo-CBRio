// FOTOS DO BATISMO · álbum privado por cerimônia (24/11/2026).
//
// O ERP publica um álbum por data de batismo e a pessoa logada só enxerga o
// álbum da data em que ELA foi batizada. Essa régua mora no servidor (rotas
// `/app/batismo/fotos*` do ERP, `batismo_album_acessos` no banco); aqui o app só
// pergunta, mostra e valida o que recebe.
//
// ⚠️ Substitui a galeria antiga, que listava um bucket PÚBLICO (`batismos/AAAA-MM-DD`)
// que ficou vazio. Nada daqui lê storage direto.
//
// ⚠️ As funções puras (validação de URL, normalização, junção de páginas,
// tamanho) ficam neste arquivo e são testadas em `test/batismoFotos.test.ts`.
// As chamadas de rede usam `apiGet` (que põe o Bearer da sessão).
//
// ⚠️⚠️ O link de download do SharePoint é portador por 10 minutos: NUNCA vai para
// log, telemetria ou mensagem de erro. Por isso as mensagens daqui são fixas.
import { apiGet, type ErroApi } from "./api";
import { ehUuid } from "./batismoFotosDestino";

/** Base da API (a mesma de `lib/api.ts`; `www.` direto, sem o 307 do apex). */
export const BASE_API = "https://www.cbrio.org/api";
/** Único caminho que o app aceita para miniatura/foto grande. */
export const PREFIXO_MINIATURA = "/app/batismo/fotos/miniatura/";
export const FOTOS_POR_PAGINA = 60;
/**
 * O token da miniatura vence entre 2 e 3 h depois de emitido (o servidor
 * arredonda para a hora cheia). Lista mais velha que isto é renovada antes de
 * a pessoa ver foto quebrada.
 */
export const VALIDADE_SEGURA_MS = 100 * 60 * 1000;

export type SituacaoAlbum = "liberado" | "conflito";
export type AlbumBatismo = {
  id: string;
  data_batismo: string;
  situacao: SituacaoAlbum;
  total: number | null;
  publicado_em: string | null;
};
export type RespostaAlbuns = { conta: "ok" | "sem_cadastro"; albuns: AlbumBatismo[] };

export type FotoAlbum = {
  id: string;
  nome: string;
  /** Bytes do ORIGINAL, quando o servidor sabe. */
  tamanho: number | null;
  /** URL absoluta e já validada; `null` quando o caminho veio fora do padrão. */
  miniatura: string | null;
  grande: string | null;
};
export type PaginaAlbum = {
  album: { id: string; data_batismo: string; total: number | null };
  fotos: FotoAlbum[];
  proximoCursor: string | null;
};
export type LinkDownload = { url: string; nome: string; tamanho: number | null; validadeS: number };

const DATA_ISO = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Caminho relativo da miniatura → URL absoluta. Só aceita `/app/batismo/fotos/miniatura/<token>`,
 * com o token num segmento único de caracteres seguros: nada de `/`, `..`, `%`,
 * `?`, `#` ou espaço. Qualquer outra coisa vira `null` (o app não monta URL
 * para lugar que o servidor não deveria ter mandado).
 */
export function urlDaMiniatura(caminho: unknown): string | null {
  if (typeof caminho !== "string" || caminho.length > 2000) return null;
  if (!caminho.startsWith(PREFIXO_MINIATURA)) return null;
  const token = caminho.slice(PREFIXO_MINIATURA.length);
  if (!/^[A-Za-z0-9._~-]+$/.test(token) || /^\.+$/.test(token)) return null;
  return BASE_API + caminho;
}

/**
 * O link do ORIGINAL só vale se for `https:` num host `*.sharepoint.com`, sem
 * usuário/senha embutidos e sem porta estranha.
 */
export function linkDeDownloadValido(url: unknown): url is string {
  if (typeof url !== "string" || !url || url.length > 8000) return false;
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return false;
  }
  if (u.protocol !== "https:") return false;
  if (u.username || u.password) return false;
  if (u.port && u.port !== "443") return false;
  const host = u.hostname.toLowerCase();
  return host.endsWith(".sharepoint.com") && host.length > ".sharepoint.com".length;
}

const numeroOuNull = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : null);
const textoOuNull = (v: unknown) => (typeof v === "string" && v ? v : null);

/** Resposta de `GET /app/batismo/fotos` → só álbuns bem formados, do mais recente. */
export function normalizarAlbuns(bruto: unknown): RespostaAlbuns {
  const r = (bruto && typeof bruto === "object" ? bruto : {}) as { conta?: unknown; albuns?: unknown };
  const conta = r.conta === "ok" ? "ok" : "sem_cadastro";
  const lista = Array.isArray(r.albuns) ? r.albuns : [];
  const albuns: AlbumBatismo[] = [];
  for (const a of lista) {
    if (!a || typeof a !== "object") continue;
    const x = a as Record<string, unknown>;
    if (!ehUuid(x.id) || typeof x.data_batismo !== "string" || !DATA_ISO.test(x.data_batismo)) continue;
    if (x.situacao !== "liberado" && x.situacao !== "conflito") continue;
    albuns.push({
      id: x.id,
      data_batismo: x.data_batismo,
      situacao: x.situacao,
      total: numeroOuNull(x.total),
      publicado_em: textoOuNull(x.publicado_em),
    });
  }
  albuns.sort((a, b) => (a.data_batismo < b.data_batismo ? 1 : a.data_batismo > b.data_batismo ? -1 : 0));
  return { conta, albuns };
}

/** Resposta de uma página do álbum → fotos com URL absoluta validada. */
export function normalizarPagina(bruto: unknown): PaginaAlbum {
  const r = (bruto && typeof bruto === "object" ? bruto : {}) as Record<string, unknown>;
  const album = (r.album && typeof r.album === "object" ? r.album : {}) as Record<string, unknown>;
  const fotos: FotoAlbum[] = [];
  for (const f of Array.isArray(r.fotos) ? r.fotos : []) {
    if (!f || typeof f !== "object") continue;
    const x = f as Record<string, unknown>;
    if (!ehUuid(x.id)) continue;
    fotos.push({
      id: x.id,
      nome: textoOuNull(x.nome) ?? "foto",
      tamanho: numeroOuNull(x.tamanho),
      miniatura: urlDaMiniatura(x.miniatura_url),
      grande: urlDaMiniatura(x.grande_url),
    });
  }
  return {
    album: {
      id: ehUuid(album.id) ? album.id : "",
      data_batismo: typeof album.data_batismo === "string" ? album.data_batismo : "",
      total: numeroOuNull(album.total),
    },
    fotos,
    proximoCursor: textoOuNull(r.proximo_cursor),
  };
}

/** Acrescenta a página nova sem repetir id (paginação nunca duplica a grade). */
export function juntarFotos(atuais: readonly FotoAlbum[], novas: readonly FotoAlbum[]): FotoAlbum[] {
  const vistos = new Set(atuais.map((f) => f.id));
  const saida = [...atuais];
  for (const f of novas) {
    if (vistos.has(f.id)) continue;
    vistos.add(f.id);
    saida.push(f);
  }
  return saida;
}

/** Teto de páginas numa varredura ("Selecionar todas", recarregar mantendo a posição). */
export const MAX_PAGINAS_POR_VARREDURA = 100;

/**
 * Busca páginas seguidas até `parar(quantidade)` ou o fim do álbum. Quem busca
 * é injetado (`buscar`), então a régua é PURA e testada sem rede.
 * - `inicio.cursor === null` com `inicio.fotos` vazio = começa do zero.
 * - `inicio.cursor === null` com fotos = já está no fim: não busca nada.
 * ⚠️ Cursor que se repete ou página que não traz id novo encerra a varredura
 * (servidor com defeito não vira laço infinito de rede).
 */
export async function percorrerPaginas(
  buscar: (cursor: string | null) => Promise<PaginaAlbum>,
  inicio: { fotos: readonly FotoAlbum[]; cursor: string | null },
  parar: (quantidade: number) => boolean = () => false,
): Promise<{ fotos: FotoAlbum[]; cursor: string | null; carregadaEm: number | null }> {
  let fotos = [...inicio.fotos];
  let cursor = inicio.cursor;
  let carregadaEm: number | null = null;
  if (cursor === null && fotos.length > 0) return { fotos, cursor, carregadaEm };
  for (let volta = 0; volta < MAX_PAGINAS_POR_VARREDURA; volta += 1) {
    const r = await buscar(cursor);
    if (carregadaEm === null) carregadaEm = Date.now();
    const antes = fotos.length;
    fotos = juntarFotos(fotos, r.fotos);
    const travou = r.proximoCursor !== null && (r.proximoCursor === cursor || fotos.length === antes);
    cursor = travou ? null : r.proximoCursor;
    if (!cursor || parar(fotos.length)) break;
  }
  return { fotos, cursor, carregadaEm };
}

/** O álbum que abre primeiro: o pedido (se a pessoa tem acesso), senão o liberado mais recente. */
export function albumInicial(albuns: readonly AlbumBatismo[], pedido?: string | null): AlbumBatismo | null {
  if (pedido) {
    const achado = albuns.find((a) => a.id === pedido);
    if (achado) return achado;
  }
  return albuns.find((a) => a.situacao === "liberado") ?? albuns[0] ?? null;
}

/** Lista carregada há tempo demais: os tokens das miniaturas podem ter vencido. */
export function listaVencida(carregadaEm: number | null, agora: number): boolean {
  return carregadaEm != null && agora - carregadaEm >= VALIDADE_SEGURA_MS;
}

/** "2026-11-22" → "22/11/2026". Data fora do formato volta como veio. */
export function rotuloDaData(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || "");
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}

/** Soma do tamanho dos originais. `desconhecidas` = fotos sem tamanho informado. */
export function tamanhoSomado(fotos: readonly { tamanho: number | null }[]) {
  let bytes = 0;
  let desconhecidas = 0;
  for (const f of fotos) {
    if (typeof f.tamanho === "number" && Number.isFinite(f.tamanho) && f.tamanho >= 0) bytes += f.tamanho;
    else desconhecidas += 1;
  }
  return { bytes, desconhecidas };
}

/** 182_000_000 → "174 MB" (base 1024, sem casa decimal acima de 10). */
export function formatarTamanho(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 MB";
  const mb = bytes / (1024 * 1024);
  if (mb >= 1024) {
    const gb = mb / 1024;
    return `${gb >= 10 ? Math.round(gb) : gb.toFixed(1).replace(".", ",")} GB`;
  }
  if (mb < 1) return "1 MB";
  return `${mb >= 10 ? Math.round(mb) : mb.toFixed(1).replace(".", ",")} MB`;
}

/** Lote que merece aviso de tamanho e sugestão de Wi-Fi antes de começar. */
export const LOTE_GRANDE_FOTOS = 10;
export const LOTE_GRANDE_BYTES = 50 * 1024 * 1024;
export function loteGrande(fotos: readonly { tamanho: number | null }[]): boolean {
  if (fotos.length >= LOTE_GRANDE_FOTOS) return true;
  return tamanhoSomado(fotos).bytes >= LOTE_GRANDE_BYTES;
}

export type ErroFotos =
  | { tipo: "sem_acesso" }
  | { tipo: "conflito"; mensagem: string | null }
  | { tipo: "cursor" }
  | { tipo: "sessao" }
  | { tipo: "falha" };

/**
 * Erro da API → o que a tela faz. ⚠️ 503/rede/qualquer outro é "falha" (tentar
 * de novo), NUNCA "álbum vazio": erro não vira lista vazia.
 */
export function classificarErroFotos(e: unknown): ErroFotos {
  const err = (e && typeof e === "object" ? e : {}) as ErroApi;
  const corpo = (err.corpo && typeof err.corpo === "object" ? err.corpo : {}) as { codigo?: unknown; error?: unknown };
  if (err.status === 409 || corpo.codigo === "conflito") {
    return { tipo: "conflito", mensagem: typeof corpo.error === "string" && corpo.error ? corpo.error : null };
  }
  if (err.status === 404 || corpo.codigo === "sem_acesso") return { tipo: "sem_acesso" };
  if (err.status === 400) return { tipo: "cursor" };
  if (err.status === 401) return { tipo: "sessao" };
  return { tipo: "falha" };
}

function erroLocal(status: number, codigo: string): ErroApi {
  const e = new Error("Álbum não encontrado.") as ErroApi;
  e.status = status;
  e.corpo = { codigo };
  return e;
}

// ── Chamadas ───────────────────────────────────────────────────────────────

export async function listarAlbuns(): Promise<RespostaAlbuns> {
  return normalizarAlbuns(await apiGet<unknown>("/app/batismo/fotos"));
}

export async function paginaDoAlbum(albumId: string, cursor?: string | null, limite = FOTOS_POR_PAGINA): Promise<PaginaAlbum> {
  if (!ehUuid(albumId)) throw erroLocal(404, "sem_acesso");
  const partes = [`limite=${encodeURIComponent(String(limite))}`];
  if (cursor) partes.unshift(`cursor=${encodeURIComponent(cursor)}`);
  return normalizarPagina(await apiGet<unknown>(`/app/batismo/fotos/${albumId}/itens?${partes.join("&")}`));
}

/**
 * Link curto do ORIGINAL. Pedir imediatamente antes de baixar cada foto: num
 * lote grande, link pedido antes vence (validade de 10 min).
 */
export async function linkDeDownload(albumId: string, fotoId: string): Promise<LinkDownload> {
  if (!ehUuid(albumId) || !ehUuid(fotoId)) throw erroLocal(404, "sem_acesso");
  const r = (await apiGet<unknown>(`/app/batismo/fotos/${albumId}/itens/${fotoId}/download`)) as Record<string, unknown> | null;
  if (!r || !linkDeDownloadValido(r.url)) throw new Error("O link da foto não é válido. Tente de novo.");
  return {
    url: r.url,
    nome: textoOuNull(r.nome) ?? "foto",
    tamanho: numeroOuNull(r.tamanho),
    validadeS: numeroOuNull(r.validade_s) ?? 600,
  };
}
