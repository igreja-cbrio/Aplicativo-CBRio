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
    { label: "Conteúdos", icon: "library-outline", href: "/conteudos" },
  ] },
  { title: "Você", items: [
    { label: "Meu perfil", icon: "person-outline", href: "/perfil" },
    { label: "Minha família", icon: "people-outline", href: "/familia" },
    { label: "Sua jornada", icon: "trail-sign-outline", href: "/jornada" },
    { label: "Censo", icon: "clipboard-outline", href: "/censo" },
  ] },
  { title: "Ajustes", items: [
    { label: "Configurações", icon: "settings-outline", href: "/configuracoes" },
    { label: "Ajuda com o app", icon: "help-buoy-outline", href: "/ajuda-app" },
  ] },
] as const;
