// Os 5 valores da jornada CBRio e as telas que pertencem a cada um.
// Régua PURA: o nome do valor aparece no topo da tela (components/ui/ValorHeader).
// O nome é PT fixo — é nome próprio da jornada, não passa por t().
export type Valor = { key: string; nome: string; rotas: string[] };

export const VALORES: Valor[] = [
  { key: "seguir", nome: "Seguir a Jesus", rotas: ["/batismo", "/modo-culto", "/culto-detalhe"] },
  { key: "conectar", nome: "Conectar", rotas: ["/grupos", "/meu-grupo", "/grupo-detalhe"] },
  { key: "investir", nome: "Investir tempo com Deus", rotas: ["/devocional"] },
  { key: "servir", nome: "Servir", rotas: ["/voluntariado"] },
  { key: "generosidade", nome: "Generosidade", rotas: ["/generosidade"] },
];

/** Casa pela rota base (ignora query, hash e barra final). Prefixo NÃO casa. */
export function valorDaRota(pathname: string): Valor | null {
  const base = (pathname || "").split(/[?#]/)[0].replace(/\/+$/, "");
  if (!base) return null;
  return VALORES.find((v) => v.rotas.includes(base)) ?? null;
}
