/**
 * Tema base do aplicativo CBRio — paletas clara e escura.
 * Cores via `useColors()` (contexts/ThemeContext); espaçamentos/tipografia abaixo.
 *
 * Paleta da marca CBRio:
 *   #408097 azul/teal principal · #70a8b0 teal médio · #d5e4e6 azul claro · #eae3da areia
 */
export const brand = {
  primary: "#408097",
  primaryMid: "#70a8b0",
  pale: "#d5e4e6",
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
};

export const darkColors: Palette = {
  background: "#0B1F26",
  surface: "#102A33",
  surfaceAlt: "#16323D",
  glass: "rgba(255,255,255,0.08)",
  glassBorder: "rgba(255,255,255,0.14)",
  dockBg: "rgba(16,42,51,0.55)",
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
};

export const lightColors: Palette = {
  background: "#F4F8F9",
  surface: "#FFFFFF",
  surfaceAlt: "#EAF1F3",
  glass: "rgba(64,128,151,0.08)",
  glassBorder: "rgba(11,31,38,0.10)",
  dockBg: "rgba(255,255,255,0.6)",
  primary: brand.primary,
  primaryDark: "#33697C",
  brandMid: brand.primary,
  brandPale: brand.primary, // no claro, o coração/ícone fica teal (visível no fundo claro)
  sand: brand.sand,
  text: "#0B1F26",
  textMuted: "#5C7A85",
  border: "#DCE6E9",
  danger: "#C0473C",
  success: "#2E8B57",
};

export const palettes = { light: lightColors, dark: darkColors } as const;

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 } as const;
export const radius = { sm: 8, md: 12, lg: 20, xl: 28, full: 999 } as const;
export const font = {
  size: { sm: 13, md: 15, lg: 18, xl: 24, xxl: 32 },
} as const;
