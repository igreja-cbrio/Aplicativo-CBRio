/**
 * Tema base do aplicativo CBRio — paletas clara e escura.
 * Cores via `useColors()` (contexts/ThemeContext); espaçamentos/tipografia abaixo.
 *
 * Paleta da marca CBRio:
 *   #408097 azul/teal principal · #70a8b0 teal médio · #d5e4e6 azul claro · #eae3da areia
 */
export const brand = {
  primary: "#355b62",
  primaryMid: "#a1bec1",
  pale: "#dce7e5",
  sand: "#eae3da",
} as const;

export type Palette = {
  background: string;
  surface: string;
  surfaceAlt: string;
  glass: string;
  glassBorder: string;
  dockBg: string;
  primary: string;
  primaryDark: string;
  brandMid: string;
  brandPale: string;
  sand: string;
  text: string;
  textMuted: string;
  border: string;
  danger: string;
  success: string;
  /**
   * ⚠️ ATENÇÃO — "isso espera por você", sem gritar "erro" (05/08/2026).
   * A paleta tinha só danger e success, então pedido pendente e encontro
   * atrasado eram pintados de vermelho (assusta) ou de teal (não chama).
   * Usar SÓ pra o que precisa de ação de gente; vermelho fica pra destruir.
   */
  warning: string;
};

export const darkColors: Palette = {
  background: "#233c42",
  surface: "#314b51",
  surfaceAlt: "#3a555b",
  glass: "rgba(255,255,255,0.08)",
  glassBorder: "rgba(255,255,255,0.14)",
  dockBg: "#314b51",
  primary: "#408097",
  primaryDark: "#29434a",
  brandMid: brand.primaryMid,
  brandPale: brand.pale,
  sand: brand.sand,
  text: "#F4F8F9",
  textMuted: "#c2d1d2",
  border: "#607a7e",
  danger: "#E5757A",
  success: "#5BB98C",
  warning: "#E0A24E",
};

export const lightColors: Palette = {
  background: "#f2f3ef",
  surface: "#FFFFFF",
  surfaceAlt: "#e6ece8",
  glass: "rgba(64,128,151,0.08)",
  glassBorder: "rgba(11,31,38,0.10)",
  dockBg: "rgba(255,255,255,0.6)",
  primary: brand.primary,
  primaryDark: "#29434a",
  brandMid: brand.primary,
  brandPale: brand.primary, // no claro, o coração/ícone fica teal (visível no fundo claro)
  sand: brand.sand,
  text: "#203a40",
  textMuted: "#536d70",
  border: "#cad6d1",
  danger: "#C0473C",
  success: "#2E8B57",
  warning: "#A86A12",
};

export const palettes = { light: lightColors, dark: darkColors } as const;

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 } as const;
export const radius = { sm: 12, md: 18, lg: 28, xl: 32, full: 999 } as const;
export const font = {
  size: { sm: 13, md: 15, lg: 18, xl: 24, xxl: 32 },
} as const;
