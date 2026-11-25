// Réguas PURAS do menu e da tela única de avisos e notificações (25/11/2026).

/** As duas tags da tela /notificacoes. */
export type AbaAvisos = "notificacoes" | "avisos";

/**
 * Com qual tag a tela abre. O parâmetro `aba` manda; sem ele, a porta antiga
 * `/noticias` abre em Avisos e todo o resto (menu, sino) em Notificações.
 */
export function abaInicial(aba: string | string[] | undefined, pathname: string): AbaAvisos {
  const valor = Array.isArray(aba) ? aba[0] : aba;
  if (valor === "avisos" || valor === "notificacoes") return valor;
  return pathname === "/noticias" ? "avisos" : "notificacoes";
}

/** Destino do "veja o que está acontecendo" e dos avisos do carrossel da Home. */
export const DESTINO_AVISOS = { pathname: "/notificacoes", params: { aba: "avisos" } } as const;

export type CensoNoMenu = {
  pesquisa: unknown | null;
  ja_respondeu?: boolean;
};

/**
 * O Censo só aparece no menu para quem tem um censo aberto ESPERANDO resposta.
 * Quem já respondeu, quem não tem censo aberto e quem ainda não tem cadastro
 * não veem o item. Quem decide é o backend (`GET /app/censo`); aqui só se lê.
 *
 * `status === null` é "o servidor não respondeu": o item APARECE, porque
 * esconder seria afirmar "você não tem censo pra responder" sem saber. A tela
 * /censo já sabe mostrar o erro. Enquanto a consulta não volta (`undefined`),
 * o item fica fora, pra não piscar na frente de quem já respondeu.
 */
export function censoNoMenu(status: CensoNoMenu | null | undefined): boolean {
  if (status === undefined) return false;
  if (status === null) return true;
  return !!status.pesquisa && !status.ja_respondeu;
}
