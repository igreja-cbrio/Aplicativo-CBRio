// ============================================================================
// CAPA DO GRUPO · a régua de qual arquivo sobe (07/08/2026 · fecho da Onda 2)
//
// A capa nunca funcionou pra ninguém: 0 de 278 linhas com `foto_url` e 0
// objetos no bucket desde 04/06. Agora o upload sai pelo backend, e o servidor
// só aceita jpg/png/webp — então o formato precisa ser decidido AQUI, antes de
// gastar a subida de uma imagem que vai voltar 400.
//
// ⚠️ POR QUE NÃO DERIVAR DA URI, que era o que a tela fazia
// (`asset.uri.split(".").pop()`): no Android a URI é `content://media/…` e não
// tem extensão nenhuma — o código antigo montava `image/media` como
// Content-Type. No iOS a URI é `file:///…/ImagePicker/UUID.jpg`, que funciona
// por acidente. Quem sabe o formato é o `mimeType` do picker; a URI é o plano B.
// ============================================================================

/** Os 3 formatos que o servidor aceita (espelha `backend/utils/grupoCapaApp.js`). */
export const TIPOS_CAPA = ["image/jpeg", "image/png", "image/webp"] as const;
export type TipoCapa = (typeof TIPOS_CAPA)[number];

const POR_EXTENSAO: Record<string, TipoCapa> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

const EXTENSAO_DE: Record<TipoCapa, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/** Extensão do fim da URI, ignorando query/fragmento. `null` se não houver. */
function extensaoDaUri(uri: string): string | null {
  const semQuery = uri.split(/[?#]/)[0];
  const ultimo = semQuery.split("/").pop() ?? "";
  const i = ultimo.lastIndexOf(".");
  if (i < 0 || i === ultimo.length - 1) return null;
  return ultimo.slice(i + 1).toLowerCase();
}

/**
 * Formato do arquivo escolhido: o `mimeType` do picker manda; a URI é o plano B.
 * `null` = formato que o servidor recusaria (HEIC do iPhone, GIF, PDF…).
 *
 * ⚠️ Devolver `null` em vez de "chutar image/jpeg" é de propósito: mentir o
 * Content-Type faria o Storage guardar um HEIC com nome de JPEG, que nenhum
 * navegador abre — a capa apareceria quebrada no catálogo público e ninguém
 * saberia por quê. Melhor recusar na hora, com mensagem clara.
 */
export function tipoDaCapa(mimeType: string | null | undefined, uri: string): TipoCapa | null {
  const m = String(mimeType ?? "").trim().toLowerCase();
  if ((TIPOS_CAPA as readonly string[]).includes(m)) return m as TipoCapa;
  // `image/jpg` não é mime válido, mas alguns Android devolvem exatamente isso.
  if (m === "image/jpg") return "image/jpeg";
  const ext = extensaoDaUri(String(uri ?? ""));
  return (ext && POR_EXTENSAO[ext]) || null;
}

/**
 * O arquivo pronto pro `FormData`, ou `null` se o formato não serve.
 *
 * ⚠️ O `name` é NOSSO, não o do aparelho: o nome original pode ter acento,
 * espaço, emoji ou 200 caracteres, e ele viaja no cabeçalho do multipart. O
 * servidor ignora esse nome (o caminho no Storage é derivado do id do grupo),
 * então ele só precisa carregar a extensão certa.
 */
export function arquivoDaCapa(
  asset: { uri: string; mimeType?: string | null } | null | undefined,
): { uri: string; name: string; type: TipoCapa } | null {
  const uri = String(asset?.uri ?? "").trim();
  if (!uri) return null;
  const type = tipoDaCapa(asset?.mimeType, uri);
  if (!type) return null;
  return { uri, name: `capa.${EXTENSAO_DE[type]}`, type };
}

/** Teto do servidor (multer). Repetido aqui só pra mensagem — quem barra é ele. */
export const MAX_CAPA_BYTES = 4 * 1024 * 1024;

/**
 * A imagem cabe no envio?
 *
 * ⚠️ FAIL-OPEN quando o tamanho é desconhecido (`undefined`/`null`/NaN): o
 * `ImagePicker` nem sempre preenche `fileSize`, e recusar por um dado que a
 * gente não conseguiu ler barraria envio legítimo. Se passar do teto, quem
 * recusa é o multer — com 400 e mensagem, não com 413 mudo.
 */
export function capaCabe(bytes: number | null | undefined): boolean {
  if (typeof bytes !== "number" || !Number.isFinite(bytes) || bytes <= 0) return true;
  return bytes <= MAX_CAPA_BYTES;
}
