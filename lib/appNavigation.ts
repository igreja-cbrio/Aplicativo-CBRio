/** Item do menu que só aparece quando `censoNoMenu` (lib/menuRegras.ts) deixa. */
export const ROTA_CENSO = "/censo";

/** Destinos compartilhados pela Home, pelo rodapé e pelo menu lateral. */
export const QUICK_LINKS = [
  { label: "Cuidados", icon: "heart-outline", href: "/cuidados" },
  { label: "Devocional", icon: "book-outline", href: "/devocional" },
  { label: "Grupos", icon: "people-outline", href: "/meu-grupo" },
  // Capacete desde 27/11/2026 (a mão era igual à de Cuidados) · components/ui/Icone.tsx
  { label: "Servir", icon: "capacete", href: "/voluntariado" },
  { label: "Generosidade", icon: "gift-outline", href: "/generosidade" },
] as const;

export const MENU_SECTIONS = [
  { title: "Comunidade", items: [
    { label: "Início", icon: "home-outline", href: "/" },
    { label: "Agenda", icon: "calendar-outline", href: "/agenda" },
    { label: "Avisos e notificações", icon: "notifications-outline", href: "/notificacoes" },
  ] },
  { title: "Viver a CBRio", items: QUICK_LINKS },
  { title: "Participar", items: [
    { label: "Inscrições", icon: "create-outline", href: "/inscricoes" },
  ] },
  { title: "Conteúdo", items: [
    { label: "Pregações", icon: "play-circle-outline", href: "/videos" },
  ] },
  { title: "Você", items: [
    { label: "Meu perfil", icon: "person-outline", href: "/perfil" },
    { label: "KIDS", icon: "happy-outline", href: "/kids-area" },
    { label: "Sua jornada", icon: "trail-sign-outline", href: "/jornada" },
    { label: "Censo", icon: "clipboard-outline", href: "/censo" },
  ] },
  { title: "Ajustes", items: [
    { label: "Configurações", icon: "settings-outline", href: "/configuracoes" },
    { label: "Ajuda com o app", icon: "help-buoy-outline", href: "/ajuda-app" },
  ] },
] as const;

/**
 * Telas de LEITURA sem casca nenhuma (27/11/2026 · pedido do Marcos: "o menu não
 * aparece dentro da Bíblia, a ideia é não distrair e nem fazer pessoas errarem
 * clique; essa será a única tela sem menu"). Sai-se pela seta da própria tela.
 */
export const ROTAS_DE_LEITURA = ["/biblia"] as const;

/** A casca é definida pela própria tela, nunca pela rota que está por cima dela. */
export function chromeDaTela(rota: string) {
  const caminho = rota === "index" ? "/" : rota.startsWith("/") ? rota : `/${rota}`;
  const semBarra = caminho.startsWith("/completar-cadastro") || caminho === "/inscricao-formulario" || caminho === "/fale-conosco-chat"
    || (ROTAS_DE_LEITURA as readonly string[]).includes(caminho);
  return {
    caminho,
    dock: !semBarra,
    header: !semBarra && caminho !== "/",
    voltar: ["/meu-grupo", "/voluntariado", "/cuidados", "/devocional", "/menu", "/agenda"].includes(caminho),
  };
}
