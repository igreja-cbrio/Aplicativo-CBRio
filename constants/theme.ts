/**
 * Tema base do aplicativo CBRio.
 * Paleta oficial da marca + espaçamentos e tipografia compartilhados.
 *
 * Paleta CBRio:
 *   #408097  azul/teal principal (marca, logo)
 *   #70a8b0  teal médio
 *   #d5e4e6  azul claro
 *   #eae3da  areia / off-white
 */
export const brand = {
  primary: "#408097",
  primaryMid: "#70a8b0",
  pale: "#d5e4e6",
  sand: "#eae3da",
} as const;

export const colors = {
  // Fundo escuro com tom teal (alinhado à marca, mantém o visual "glass").
  background: "#0B1F26",
  surface: "#102A33",
  surfaceAlt: "#16323D",
  glass: "rgba(255,255,255,0.08)",
  glassBorder: "rgba(255,255,255,0.14)",

  primary: brand.primary,
  primaryDark: "#33697C",
  brandMid: brand.primaryMid,
  brandPale: brand.pale,
  sand: brand.sand,

  text: "#F4F8F9",
  textMuted: "#9FB8BF",
  border: "#1F3D47",
  danger: "#E5757A",
  success: "#5BB98C",
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 20,
  xl: 28,
  full: 999,
} as const;

export const font = {
  size: {
    sm: 13,
    md: 15,
    lg: 18,
    xl: 24,
    xxl: 32,
  },
} as const;
