import { apiGet } from "@/lib/api";
import { cacheSWR } from "@/lib/cache";
import type { Catalogo } from "@/lib/conteudos";

/**
 * Catálogo publicado de Conteúdos (igual entre usuários → cacheSWR, TTL 10
 * min; pull-to-refresh passa `forcar`). Erro de rede com cache → serve o
 * stale; sem cache → lança (a tela mostra o erro, nunca lista vazia muda).
 */
export function carregarCatalogo(forcar = false): Promise<Catalogo> {
  return cacheSWR<Catalogo>("conteudos", () => apiGet<Catalogo>("/app/conteudos"), {
    ttlMs: 10 * 60_000,
    forcar,
  });
}
