/** Destinos compartilhados pela Home, pelo rodapé e pelo menu lateral. */
export const QUICK_LINKS = [
  { label: "Cuidados", icon: "heart-outline", href: "/cuidados" },
  { label: "Devocional", icon: "book-outline", href: "/devocional" },
  { label: "Grupos", icon: "people-outline", href: "/meu-grupo" },
  { label: "Servir", icon: "hand-left-outline", href: "/voluntariado" },
  { label: "Generosidade", icon: "gift-outline", href: "/generosidade" },
] as const;

export const MENU_SECTIONS = [
  { title: "Comunidade", items: [
    { label: "Início", icon: "home-outline", href: "/" },
    { label: "Notícias e avisos", icon: "megaphone-outline", href: "/noticias" },
    { label: "Agenda e destaques", icon: "calendar-outline", href: "/agenda" },
    { label: "Notificações", icon: "notifications-outline", href: "/notificacoes" },
  ] },
  { title: "Viver a CBRio", items: QUICK_LINKS },
  { title: "Participar", items: [
    { label: "Inscrições", icon: "create-outline", href: "/inscricoes" },
  ] },
  { title: "Conteúdo", items: [
    { label: "Pregações", icon: "play-circle-outline", href: "/videos" },
  ] },
  { title: "Você", items: [
    { label: "Carta de transferência", icon: "document-text-outline", href: "/carta-transferencia" },
    { label: "Meu perfil", icon: "person-outline", href: "/perfil" },
    { label: "Minha família", icon: "people-outline", href: "/familia" },
    { label: "KIDS", icon: "happy-outline", href: "/kids-area" },
    { label: "Sua jornada", icon: "trail-sign-outline", href: "/jornada" },
    { label: "Censo", icon: "clipboard-outline", href: "/censo" },
  ] },
  { title: "Ajustes", items: [
    { label: "Configurações", icon: "settings-outline", href: "/configuracoes" },
    { label: "Ajuda com o app", icon: "help-buoy-outline", href: "/ajuda-app" },
  ] },
] as const;

/** A casca é definida pela própria tela, nunca pela rota que está por cima dela. */
export function chromeDaTela(rota: string) {
  const caminho = rota === "index" ? "/" : rota.startsWith("/") ? rota : `/${rota}`;
  const semBarra = caminho.startsWith("/completar-cadastro") || caminho === "/inscricao-formulario";
  return {
    caminho,
    dock: !semBarra,
    header: !semBarra && caminho !== "/",
    voltar: ["/meu-grupo", "/voluntariado", "/cuidados", "/devocional", "/menu", "/agenda"].includes(caminho),
  };
}
