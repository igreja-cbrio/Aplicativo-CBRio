/** base64 do picker → data URL. Vazio ou com caractere fora do base64 vira `null`. */
export function dataUrlDaSelfie(base64: unknown): string | null {
  if (typeof base64 !== "string") return null;
  const limpo = base64.replace(/\s+/g, "");
  if (!limpo || !/^[A-Za-z0-9+/]+={0,2}$/.test(limpo)) return null;
  return `data:image/jpeg;base64,${limpo}`;
}
