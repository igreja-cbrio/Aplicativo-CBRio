/**
 * Tema base do aplicativo CBRio.
 * Cores, espaçamentos e tipografia compartilhados entre os módulos.
 */
export const colors = {
  background: "#0B1220",
  surface: "#131C2E",
  surfaceAlt: "#1B2740",
  primary: "#2F6BFF",
  primaryDark: "#1E4FCC",
  text: "#F5F7FB",
  textMuted: "#9AA6BF",
  border: "#27324A",
  danger: "#E5484D",
  success: "#30A46C",
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
