// Censo nativo no app · fala com os MESMOS endpoints públicos do formulário web.
//
// Decisão: nada de endpoint novo. O `GET /api/public/censo/:slug` já devolve o
// questionário inteiro e tem cache de 30s na borda — no pico do culto, centenas
// de aparelhos pedindo o mesmo questionário batem no cache, não no banco. E o
// `POST /:slug/responder` já faz validação, idempotência por `envio_id`, fila de
// cuidado e vínculo de identidade. Duplicar isso num endpoint "do app" seria
// criar um segundo caminho de escrita para o mesmo dado.
//
// O que o app acrescenta é só a IDENTIDADE: o token que o `/app/censo` emite
// entra como `identidade` e é o que dá `identificado_por='cpf_nascimento'` —
// sem a pessoa digitar CPF nem nascimento.
import type { Pergunta, Respostas } from "@/lib/censoForm";

const BASE = "https://www.cbrio.org/api/public/censo";

export type PesquisaPublica = {
  slug: string;
  titulo: string;
  subtitulo?: string | null;
  perguntas: Pergunta[];
  config?: Record<string, unknown>;
  consentimento_texto?: string | null;
};

/**
 * Tipos que o app sabe RENDERIZAR. É uma allowlist de propósito.
 *
 * ⚠️ Tipo fora desta lista NÃO pode ser ignorado em silêncio: a pessoa enviaria
 * o censo sem responder uma pergunta que existe, e o gráfico daquela pergunta
 * ficaria vazio sem ninguém entender por quê. Quando aparece um tipo novo no
 * questionário, o app manda a pessoa para o formulário da WEB, que é sempre a
 * implementação completa. É o preço honesto de ter dois formulários.
 */
export const TIPOS_SUPORTADOS = new Set([
  "secao", "texto_curto", "texto_longo", "data", "numero",
  "escala_5", "estrelas_5", "nps", "sim_nao", "opcao_unica", "multipla", "busca",
]);

/** Tipos presentes no questionário que este app não renderiza. */
export function tiposNaoSuportados(perguntas: Pergunta[]): string[] {
  const fora = new Set<string>();
  for (const p of perguntas || []) {
    if (!TIPOS_SUPORTADOS.has(p.tipo)) fora.add(p.tipo);
  }
  return [...fora];
}

async function json<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
  });
  const corpo = await r.json().catch(() => null);
  if (!r.ok) throw new Error(corpo?.error || `Falha (${r.status})`);
  return corpo as T;
}

export function buscarPesquisa(slug: string) {
  return json<PesquisaPublica>(`${BASE}/${encodeURIComponent(slug)}`);
}

/** Pré-preenche pelo token do app. Falhar aqui não impede responder. */
export function prefill(slug: string, identidade: string) {
  return json<{ valores?: Respostas; identidade?: string }>(
    `${BASE}/${encodeURIComponent(slug)}/prefill`,
    { method: "POST", body: JSON.stringify({ identidade }) },
  );
}

export type ItemCatalogo = { valor: string; rotulo: string; detalhe?: string | null };

/**
 * Catálogo do tipo `busca` (igrejas do RJ, grupos ativos).
 *
 * ⚠️ As opções NÃO vêm na pergunta e não devem: são 1.911 igrejas: baixar tudo
 * a cada abertura do questionário no culto seria absurdo. Daí a busca no
 * servidor, com cache de 1h na borda para as igrejas.
 */
export async function buscarCatalogo(catalogo: string, q: string): Promise<ItemCatalogo[]> {
  const termo = q.trim();
  if (termo.length < 2) return [];
  const r = await json<{ itens?: ItemCatalogo[] }>(
    `${BASE}/catalogo/${encodeURIComponent(catalogo)}?q=${encodeURIComponent(termo)}`,
  ).catch(() => ({ itens: [] as ItemCatalogo[] }));
  return r.itens || [];
}

export function enviarResposta(slug: string, dados: {
  respostas: Respostas;
  consentimento: boolean;
  envio_id: string;
  identidade?: string | null;
  canal?: string;
}) {
  return json<{ ok?: boolean; id?: string }>(
    `${BASE}/${encodeURIComponent(slug)}/responder`,
    { method: "POST", body: JSON.stringify({ ...dados, canal: dados.canal || "app" }) },
  );
}
