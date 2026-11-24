// BUSCA "ENCONTRAR MINHAS FOTOS" POR SELFIE · réguas puras (24/11/2026).
//
// Decisão do produto: quem já vê o álbum inteiro da própria cerimônia (340 a 946
// fotos) pode tirar uma selfie e o app separa as fotos em que a pessoa parece
// estar. O reconhecimento roda 100% no celular, numa WebView que carrega uma
// página do site da igreja (`PAGINA_BUSCA_FACIAL`). A selfie e as distâncias
// NUNCA saem do aparelho, nunca vão para disco, log, telemetria ou servidor: o
// servidor só registra o aceite (`registrarConsentimentoBusca` em
// `lib/batismoFotos.ts`).
//
// ⚠️ Tudo o que chega da página é DADO NÃO CONFIÁVEL: `lerMensagem` só aceita
// mensagens da lista fechada, com id que o app mandou e distância numérica
// válida. Texto livre da página (`msg`) é descartado: a tela mostra só os textos
// fixos de `mensagemDoErro`.
//
// ⚠️ Este arquivo é PURO (sem React, sem rede, sem nativo) e é testado em
// `test/buscaFacial.test.ts`. Os textos daqui são CHAVES de tradução: a tela
// passa cada um por `t()`, e o teste exige que todos estejam em
// `lib/translations.ts` (o portão de i18n não enxerga `t(CONSTANTE)`).

// ── Página do modelo e contrato com o servidor ─────────────────────────────
export const PAGINA_BUSCA_FACIAL = "https://www.cbrio.org/app-busca-facial/index.html?v=1";
/** `originWhitelist` da WebView. */
export const ORIGEM_BUSCA_FACIAL = "https://www.cbrio.org";
/** Única família de URLs que a WebView pode carregar (além de `about:blank`). */
const HOST_BUSCA = "www.cbrio.org";
const CAMINHO_BUSCA = "/app-busca-facial";
/**
 * As fotos que a página baixa: a mesma origem da API, no caminho de miniatura
 * que `urlDaMiniatura` (lib/batismoFotos.ts) já validou. Conferido de novo aqui
 * para a régua não depender de quem chamou.
 */
export const PREFIXO_URL_BUSCA = "https://www.cbrio.org/api/app/batismo/fotos/miniatura/";

export const VERSAO_CONSENTIMENTO = "2026-11-24";

// ── Texto do consentimento (versão 2026-11-24) ─────────────────────────────
export const CONSENTIMENTO_TITULO = "Buscar minhas fotos pelo rosto";
export const CONSENTIMENTO_CORPO =
  "A CBRio vai usar uma selfie sua para comparar o seu rosto (dado biométrico, sensível pela LGPD) com os rostos das fotos deste álbum, inclusive os de outras pessoas, e mostrar as fotos em que você parece estar.";
export const CONSENTIMENTO_ITENS = [
  "Tudo acontece no seu celular. A selfie e as medidas dos rostos não são enviadas a ninguém e são apagadas ao sair desta tela.",
  "Pode errar: confira antes de baixar.",
  "É opcional: o álbum inteiro continua disponível.",
] as const;
/** As DUAS caixas: começam desmarcadas e as duas são obrigatórias. */
export const CONSENTIMENTO_CAIXA_ROSTO = "Concordo em usar meu rosto nesta busca.";
export const CONSENTIMENTO_CAIXA_MAIORIDADE = "Tenho 18 anos ou mais.";
/** Tudo o que a tela do aceite mostra (o teste cobra as traduções). */
export const TEXTOS_CONSENTIMENTO: readonly string[] = [
  CONSENTIMENTO_TITULO,
  CONSENTIMENTO_CORPO,
  ...CONSENTIMENTO_ITENS,
  CONSENTIMENTO_CAIXA_ROSTO,
  CONSENTIMENTO_CAIXA_MAIORIDADE,
];

/** O botão só libera com as duas caixas marcadas. */
export function podeComecar(aceites: { rosto: boolean; maioridade: boolean }): boolean {
  return aceites.rosto === true && aceites.maioridade === true;
}

/** Idioma que vai no corpo do aceite: o do app; idioma sem tradução pronta cai no português. */
export function idiomaDoConsentimento(lang: string): "pt" | "en" | "es" {
  if (lang === "en") return "en";
  if (lang === "es") return "es";
  return "pt";
}

export function corpoDoConsentimento(lang: string) {
  return { versao: VERSAO_CONSENTIMENTO, declarou_maioridade: true as const, idioma: idiomaDoConsentimento(lang) };
}

// ── Limiares ───────────────────────────────────────────────────────────────
// Medidos na própria página (face-api 1.7.15, imagens de demonstração): a mesma
// pessoa deu d = 0,152; DUAS pessoas diferentes deram 0,515 e 0,596. Com o
// 0,5/0,6 do desenho original as duas pessoas diferentes cairiam em "suas" e em
// "pouca certeza" — por isso 0,45/0,55.
/** Distância abaixo disto: "Fotos suas". */
export const LIMIAR_FORTE = 0.45;
/** Entre o forte e este: "Pode ser você · pouca certeza". */
export const LIMIAR_PROVAVEL = 0.55;
/** Foto sem match a até N posições de uma foto sua (rajada da mesma pessoa) entra em "pouca certeza". */
export const VIZINHANCA_SEQUENCIA = 2;
/** Estimativa de dados por foto (miniatura de 640 px). */
export const MB_POR_FOTO = 0.08;
/** `falha_foto` com estes status é passageira: vale "Tentar de novo". 410 = link vencido (pede as páginas de novo). */
export const STATUS_RETENTAVEL: ReadonlySet<number> = new Set([0, 410, 429, 503]);
/** WebView que morre seguidas vezes sem nenhuma foto nova verificada: para e diz que deu erro. */
export const MAX_RECRIACOES = 3;
/**
 * Sem nenhuma mensagem válida da página por este tempo: a busca é dada como
 * travada. Folgado de propósito: entre o `iniciar` e o `modelos` a página baixa
 * os modelos (vários MB) sem mandar nada, e isso demora em rede ruim.
 */
export const ESPERA_SEM_SINAL_MS = 180_000;

// ── Mensagens da página ────────────────────────────────────────────────────
export type CodigoErroPagina = "modelos" | "sem_webgl" | "selfie_sem_rosto" | "selfie_varios_rostos" | "interno";
const CODIGOS_PAGINA: ReadonlySet<string> = new Set(["modelos", "sem_webgl", "selfie_sem_rosto", "selfie_varios_rostos", "interno"]);

export type MensagemBusca =
  | { t: "pronto" }
  | { t: "modelos" }
  | { t: "selfie" }
  | { t: "progresso"; feitas: number; total: number }
  | { t: "foto"; id: string; d: number | null }
  | { t: "falha_foto"; id: string; status: number }
  | { t: "fim"; feitas: number; total: number; falhas: number }
  | { t: "erro"; codigo: CodigoErroPagina };

/** Mensagem maior que isto não é do protocolo (nenhuma passa de uma centena de bytes). */
const TAMANHO_MAX_MENSAGEM = 2048;

const contagem = (v: unknown): number | null => (typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= 1_000_000 ? v : null);

/**
 * Texto que a página mandou → mensagem tipada, ou `null` para tudo o que não é
 * do protocolo: JSON inválido, `t` fora da lista, id que o app NÃO mandou neste
 * lote, distância negativa/NaN/infinita/texto, contagem quebrada.
 * `erro` com código desconhecido vira `interno` (a busca para em vez de ficar
 * esperando); o texto livre `msg` da página é descartado.
 */
export function lerMensagem(raw: unknown, idsValidos: ReadonlySet<string>): MensagemBusca | null {
  if (typeof raw !== "string" || raw.length === 0 || raw.length > TAMANHO_MAX_MENSAGEM) return null;
  let v: unknown;
  try {
    v = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  const m = v as Record<string, unknown>;
  const idDoLote = typeof m.id === "string" && idsValidos.has(m.id) ? m.id : null;
  switch (m.t) {
    case "pronto":
    case "modelos":
    case "selfie":
      return { t: m.t };
    case "progresso": {
      const feitas = contagem(m.feitas);
      const total = contagem(m.total);
      if (feitas === null || total === null || feitas > total) return null;
      return { t: "progresso", feitas, total };
    }
    case "foto": {
      if (!idDoLote) return null;
      if (m.d === null) return { t: "foto", id: idDoLote, d: null };
      if (typeof m.d !== "number" || !Number.isFinite(m.d) || m.d < 0) return null;
      return { t: "foto", id: idDoLote, d: m.d };
    }
    case "falha_foto": {
      if (!idDoLote) return null;
      const status = contagem(m.status);
      if (status === null || status > 599) return null;
      return { t: "falha_foto", id: idDoLote, status };
    }
    case "fim": {
      const feitas = contagem(m.feitas);
      const total = contagem(m.total);
      const falhas = contagem(m.falhas);
      if (feitas === null || total === null || falhas === null) return null;
      return { t: "fim", feitas, total, falhas };
    }
    case "erro":
      return { t: "erro", codigo: typeof m.codigo === "string" && CODIGOS_PAGINA.has(m.codigo) ? (m.codigo as CodigoErroPagina) : "interno" };
    default:
      return null;
  }
}

/** A mensagem só vale se veio da própria página da busca (não de outro documento/quadro). */
export function navegacaoPermitida(url: unknown): boolean {
  if (url === "about:blank") return true;
  if (typeof url !== "string" || url.length > 2000) return false;
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return false;
  }
  if (u.protocol !== "https:" || u.username || u.password) return false;
  if (u.host !== HOST_BUSCA) return false;
  return u.pathname === CAMINHO_BUSCA || u.pathname.startsWith(`${CAMINHO_BUSCA}/`);
}

// ── O que vai para a página ────────────────────────────────────────────────
export type FotoParaBusca = { id: string; url: string };

/** URL de busca aceitável: absoluta, no caminho de miniatura da API, token num segmento só. */
export function urlDeBuscaValida(url: unknown): url is string {
  if (typeof url !== "string" || url.length > 2000 || !url.startsWith(PREFIXO_URL_BUSCA)) return false;
  return /^[A-Za-z0-9._~-]+$/.test(url.slice(PREFIXO_URL_BUSCA.length)) && !/^\.+$/.test(url.slice(PREFIXO_URL_BUSCA.length));
}

/**
 * Fotos do álbum → lista que a página recebe, na ordem do álbum, sem repetir id
 * e só com URL de busca válida. `somente` restringe aos ids pedidos (retomada e
 * "Tentar de novo" mandam só o que falta).
 */
export function fotosParaBusca(
  fotos: readonly { id: string; busca: string | null }[],
  somente?: ReadonlySet<string>,
): FotoParaBusca[] {
  const vistos = new Set<string>();
  const saida: FotoParaBusca[] = [];
  for (const f of fotos) {
    if (!f || typeof f.id !== "string" || vistos.has(f.id)) continue;
    if (somente && !somente.has(f.id)) continue;
    if (!urlDeBuscaValida(f.busca)) continue;
    vistos.add(f.id);
    saida.push({ id: f.id, url: f.busca });
  }
  return saida;
}

/** Botão "Encontrar minhas fotos": servidor liberou (`busca_facial: "liberada"`), álbum liberado e fotos com URL de busca. */
export function buscaDisponivel(
  buscaFacial: string | null | undefined,
  album: { situacao: string } | null | undefined,
  fotos: readonly { busca: string | null }[],
): boolean {
  if (buscaFacial !== "liberada") return false;
  if (!album || album.situacao !== "liberado") return false;
  return fotos.some((f) => urlDeBuscaValida(f.busca));
}

/** base64 do picker → data URL. Vazio ou com caractere fora do base64 vira `null`. */
export function dataUrlDaSelfie(base64: unknown): string | null {
  if (typeof base64 !== "string") return null;
  const limpo = base64.replace(/\s+/g, "");
  if (!limpo || !/^[A-Za-z0-9+/]+={0,2}$/.test(limpo)) return null;
  return `data:image/jpeg;base64,${limpo}`;
}

/** Script do `injectJavaScript` que começa (ou retoma) a busca. JSON é expressão JS válida. */
export function scriptIniciar(selfie: string, fotos: readonly FotoParaBusca[]): string {
  return `window.__busca && window.__busca.iniciar(${JSON.stringify({ selfie, fotos })}); true;`;
}
export const SCRIPT_PARAR = "window.__busca && window.__busca.parar(); true;";

// ── Classificação ──────────────────────────────────────────────────────────
export type Faixa = "forte" | "provavel" | "nenhuma";

export function faixa(d: number | null | undefined): Faixa {
  if (typeof d !== "number" || !Number.isFinite(d) || d < 0) return "nenhuma";
  if (d < LIMIAR_FORTE) return "forte";
  if (d < LIMIAR_PROVAVEL) return "provavel";
  return "nenhuma";
}

export type Classificacao = {
  suas: string[];
  talvez: string[];
  /** Os de `talvez` que entraram SÓ por estarem perto de uma foto sua. */
  pelaSequencia: string[];
};

/**
 * Separa as fotos, na ordem do álbum:
 * - `suas`: distância < `LIMIAR_FORTE`;
 * - `talvez`: `LIMIAR_FORTE` ≤ d < `LIMIAR_PROVAVEL`, OU foto sem match (sem
 *   rosto, longe, sem resultado) a até `VIZINHANCA_SEQUENCIA` posições de uma
 *   foto sua — rajada da mesma pessoa, molhada ou de perfil.
 * Nenhuma foto aparece nas duas listas; id repetido em `ordem` conta uma vez.
 */
export function classificar(resultados: ReadonlyMap<string, number | null>, ordem: readonly string[]): Classificacao {
  const ids: string[] = [];
  const vistos = new Set<string>();
  for (const id of ordem) {
    if (typeof id !== "string" || vistos.has(id)) continue;
    vistos.add(id);
    ids.push(id);
  }
  const faixas = ids.map((id) => faixa(resultados.get(id)));
  const suas: string[] = [];
  const talvez: string[] = [];
  const pelaSequencia: string[] = [];
  for (let i = 0; i < ids.length; i += 1) {
    if (faixas[i] === "forte") {
      suas.push(ids[i]);
    } else if (faixas[i] === "provavel") {
      talvez.push(ids[i]);
    } else if (pertoDeUmaSua(faixas, i)) {
      talvez.push(ids[i]);
      pelaSequencia.push(ids[i]);
    }
  }
  return { suas, talvez, pelaSequencia };
}

function pertoDeUmaSua(faixas: readonly Faixa[], i: number): boolean {
  for (let j = Math.max(0, i - VIZINHANCA_SEQUENCIA); j <= Math.min(faixas.length - 1, i + VIZINHANCA_SEQUENCIA); j += 1) {
    if (j !== i && faixas[j] === "forte") return true;
  }
  return false;
}

// ── Andamento, retomada e "Tentar de novo" ─────────────────────────────────
/**
 * Ids do lote atual que ainda não têm resposta nenhuma (nem resultado, nem
 * falha). É o que vai num `iniciar` de RETOMADA (WebView recriada, volta do
 * segundo plano): o RN é o dono da lista e dos resultados.
 */
export function pendentes(
  lote: readonly string[],
  resultados: ReadonlyMap<string, unknown>,
  falhas: ReadonlyMap<string, number>,
): string[] {
  return lote.filter((id) => !resultados.has(id) && !falhas.has(id));
}

export type SituacaoBusca = {
  /** Fotos do álbum com resultado (com ou sem rosto). */
  verificadas: number;
  /** Fotos do álbum sem resultado: falharam, ficaram sem resposta ou nem tinham URL de busca. */
  naoVerificadas: number;
  /** As que valem "Tentar de novo": têm URL de busca e não falharam por motivo definitivo. */
  retentaveis: string[];
  /** Alguma das retentáveis falhou com 410 (link vencido): pedir as páginas de novo antes. */
  recarregarLista: boolean;
};

export function situacaoDaBusca(
  ordem: readonly string[],
  comBusca: ReadonlySet<string>,
  resultados: ReadonlyMap<string, unknown>,
  falhas: ReadonlyMap<string, number>,
): SituacaoBusca {
  let verificadas = 0;
  let naoVerificadas = 0;
  const retentaveis: string[] = [];
  let recarregarLista = false;
  const vistos = new Set<string>();
  for (const id of ordem) {
    if (vistos.has(id)) continue;
    vistos.add(id);
    if (resultados.has(id)) {
      verificadas += 1;
      continue;
    }
    naoVerificadas += 1;
    if (!comBusca.has(id)) continue;
    const status = falhas.get(id);
    if (status !== undefined && !STATUS_RETENTAVEL.has(status)) continue;
    retentaveis.push(id);
    if (status === 410) recarregarLista = true;
  }
  return { verificadas, naoVerificadas, retentaveis, recarregarLista };
}

/** O que a galeria recebe no fim: só ids e contagens. Nenhuma distância sai da busca. */
export type ResultadoBusca = Classificacao & {
  total: number;
  verificadas: number;
  naoVerificadas: number;
  interrompida: boolean;
};

export function resumirBusca(
  ordem: readonly string[],
  comBusca: ReadonlySet<string>,
  resultados: ReadonlyMap<string, number | null>,
  falhas: ReadonlyMap<string, number>,
  interrompida: boolean,
): ResultadoBusca {
  const c = classificar(resultados, ordem);
  const s = situacaoDaBusca(ordem, comBusca, resultados, falhas);
  return {
    ...c,
    total: s.verificadas + s.naoVerificadas,
    verificadas: s.verificadas,
    naoVerificadas: s.naoVerificadas,
    interrompida,
  };
}

/** Aviso de dados antes de começar: cerca de 0,08 MB por foto, arredondado para cima. */
export function estimativaMb(n: number): number {
  if (!Number.isFinite(n) || n <= 0) return 0;
  // Arredonda a 3 casas antes do teto: 25 × 0,08 em ponto flutuante passa de 2.
  return Math.max(1, Math.ceil(Math.round(n * MB_POR_FOTO * 1000) / 1000));
}

// ── Erros ──────────────────────────────────────────────────────────────────
export type ErroBusca =
  | CodigoErroPagina
  | "pagina"
  | "tempo"
  | "consentimento"
  | "menor"
  | "limite"
  | "sessao"
  | "sem_acesso"
  | "conflito"
  | "camera_negada"
  | "camera"
  | "lista"
  | "indisponivel";

const MENSAGENS: Record<ErroBusca, string> = {
  modelos: "Não foi possível preparar a busca agora. Verifique sua internet e tente de novo.",
  sem_webgl: "Este celular não consegue rodar a busca. Você ainda pode ver e baixar todas as fotos do álbum.",
  selfie_sem_rosto: "Não achamos um rosto na selfie. Tente de novo, de frente e com boa luz.",
  selfie_varios_rostos: "Apareceu mais de um rosto na selfie. Tire de novo só com você.",
  interno: "A busca parou por um erro. Tente de novo. Você ainda pode ver e baixar todas as fotos do álbum.",
  pagina: "Não foi possível abrir a busca agora. Verifique sua internet e tente de novo.",
  tempo: "A busca parou de responder. Verifique sua internet e tente de novo.",
  consentimento: "Não foi possível registrar sua autorização agora, então a busca não começou. Tente de novo.",
  menor: "A busca pelo rosto é só para quem tem 18 anos ou mais. Você ainda pode ver e baixar todas as fotos do álbum.",
  limite: "Você chegou ao limite de buscas neste álbum por hoje. Tente de novo amanhã. O álbum inteiro continua disponível.",
  sessao: "Sua sessão expirou. Entre de novo no app e tente outra vez.",
  sem_acesso: "Este álbum não está disponível para a sua conta.",
  conflito: "Encontramos mais de uma data de batismo no seu cadastro. A equipe vai conferir antes de liberar as fotos.",
  camera_negada: "O CBRio precisa da câmera para tirar a selfie. Você pode liberar nos Ajustes do aparelho.",
  camera: "Não foi possível usar a câmera agora. Tente de novo.",
  lista: "Não foi possível carregar todas as fotos do álbum. Verifique sua conexão e tente de novo.",
  indisponivel: "A busca por selfie ainda não está disponível para este álbum. Você ainda pode ver e baixar todas as fotos.",
};

export const CODIGOS_ERRO = Object.keys(MENSAGENS) as ErroBusca[];

/** Texto honesto (chave de tradução) para cada erro. Código desconhecido cai no genérico. */
export function mensagemDoErro(codigo: ErroBusca | string): string {
  return (MENSAGENS as Record<string, string>)[codigo] ?? MENSAGENS.interno;
}

export type AcaoDoErro = "selfie" | "recomecar" | "ajustes" | "nenhuma";

/** O que a tela de erro oferece: outra selfie, recomeçar, abrir Ajustes ou só voltar ao álbum. */
export function acaoDoErro(codigo: ErroBusca): AcaoDoErro {
  switch (codigo) {
    case "selfie_sem_rosto":
    case "selfie_varios_rostos":
      return "selfie";
    case "camera_negada":
      return "ajustes";
    case "modelos":
    case "interno":
    case "pagina":
    case "tempo":
    case "consentimento":
    case "camera":
    case "lista":
      return "recomecar";
    default:
      return "nenhuma";
  }
}

const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" ? (v as Record<string, unknown>) : {});

/** Erro do POST do aceite → código. Qualquer coisa fora do contrato é "não registrou" (a busca NÃO começa). */
export function erroDoConsentimento(e: unknown): ErroBusca {
  const err = obj(e);
  const codigo = obj(err.corpo).codigo;
  if (codigo === "menor") return "menor";
  if (err.status === 429 || codigo === "limite") return "limite";
  if (err.status === 409 || codigo === "conflito") return "conflito";
  if (err.status === 404 || codigo === "sem_acesso") return "sem_acesso";
  if (err.status === 401) return "sessao";
  return "consentimento";
}

/** Erro ao percorrer as páginas do álbum → código. */
export function erroDaLista(e: unknown): ErroBusca {
  const err = obj(e);
  const codigo = obj(err.corpo).codigo;
  if (err.status === 409 || codigo === "conflito") return "conflito";
  if (err.status === 404 || codigo === "sem_acesso") return "sem_acesso";
  if (err.status === 401) return "sessao";
  return "lista";
}
