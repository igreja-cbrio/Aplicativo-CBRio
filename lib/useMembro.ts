/**
 * Dados do membro logado.
 *
 * A implementação vive em `contexts/MembroContext` (carrega uma vez por
 * sessão e compartilha entre as ~12 telas). Este arquivo permanece como
 * ponto de import estável — `const { membro, loading, reload } = useMembro()`.
 */
export { useMembro, type MembroBasico } from "@/contexts/MembroContext";
