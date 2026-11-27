// ============================================================================
// Compartilhar a SEMANA INTEIRA do Quarta com Deus (27/11/2026).
//
// Pedido do Marcos: "dentro do app ter uma opção de compartilhar essa página do
// quarta com Deus, não um dia específico, mas a semana inteira". Quem repassa o
// devocional aos grupos passa a mandar daqui, em vez de copiar o texto à mão.
//
// O link abre a página pública da edição (`/quarta-com-deus/<edição>`, no ERP:
// `src/pages/public/QuartaComDeusSemana.jsx`). Quem recebe pode não ter o app,
// então a mensagem diz o que é e de quando é, sem depender de contexto.
//
// ⚠️ O caminho é montado aqui porque a tela lê as edições direto do banco e não
// há chamada ao servidor de onde tirar a URL. Em troca, o ERP tem um guarda de
// texto (`src/test/devocionalSemanaRota.test.ts`) que quebra se a rota mudar de
// nome. Host com `www.`: o `cbrio.org` puro devolve 307.
// ============================================================================

type T = (s: string) => string;
const ID: T = (s) => s;

export const BASE_DA_SEMANA = "https://www.cbrio.org/quarta-com-deus";

export type SemanaCompartilhavel = {
  /** `edicao_slug`. Edição sem slug (agrupada por "semana:AAAA-MM-DD") não tem página. */
  chave: string;
  titulo?: string | null;
  inicio?: string | null;
  fim?: string | null;
};

const ddmm = (iso?: string | null) => {
  const [, m, d] = String(iso || "").split("-");
  return d && m ? `${d}/${m}` : "";
};

/** Endereço público da edição, ou `null` se ela não tem página. */
export function urlDaSemana(chave: string | null | undefined): string | null {
  const slug = String(chave || "").trim();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 90) return null;
  return `${BASE_DA_SEMANA}/${slug}`;
}

/**
 * Texto que acompanha o link.
 * @returns `null` quando a edição não tem página — a tela ESCONDE o botão em
 *   vez de mandar mensagem sem endereço.
 */
export function mensagemDaSemana(s: SemanaCompartilhavel, t: T = ID): string | null {
  const url = urlDaSemana(s?.chave);
  if (!url) return null;
  const titulo = (s.titulo || "").trim();
  const periodo = ddmm(s.inicio) && ddmm(s.fim) ? ` (${ddmm(s.inicio)} ${t("a")} ${ddmm(s.fim)})` : "";
  // "Quarta com Deus" é nome próprio: não passa pela tradução.
  const cabeca = titulo ? `Quarta com Deus: ${titulo}${periodo}` : `Quarta com Deus${periodo}`;
  return `${cabeca}\n${t("As 7 leituras da semana, uma por dia até o culto de quarta")}:\n${url}`;
}
