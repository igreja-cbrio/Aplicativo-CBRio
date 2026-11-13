/** Posição do FAB do chat: guardada como borda + fração, nunca pixels. */
export type FabPos = { ladoDireito: boolean; yFrac: number };

export const FAB_POS_KEY = "fab-pos:v1";
/** Quanto o padrão fica acima do dock (livra o card de streak da Home). */
export const FAB_PADRAO_ACIMA = 96;

export type FabLimites = { minY: number; maxY: number; xEsq: number; xDir: number };

export function limitesFab(args: {
  width: number; height: number; tamanho: number; margem: number;
  insetTop: number; insetBottom: number; bottomOffset: number;
}): FabLimites {
  const { width, height, tamanho, margem, insetTop, insetBottom, bottomOffset } = args;
  const minY = insetTop + margem;
  const maxY = Math.max(minY, height - Math.max(bottomOffset, insetBottom) - margem - tamanho);
  return { minY, maxY, xEsq: margem, xDir: Math.max(margem, width - tamanho - margem) };
}

export function fracPadrao(l: FabLimites): number {
  const faixa = l.maxY - l.minY;
  if (faixa <= 0) return 1;
  return Math.min(1, Math.max(0, (faixa - FAB_PADRAO_ACIMA) / faixa));
}

/** Valida o que veio do AsyncStorage; qualquer coisa estranha → null (padrão). */
export function lerFabPos(raw: string | null | undefined): FabPos | null {
  if (!raw) return null;
  try {
    const o = JSON.parse(raw);
    if (!o || typeof o !== "object") return null;
    if (typeof o.ladoDireito !== "boolean") return null;
    if (typeof o.yFrac !== "number" || !Number.isFinite(o.yFrac)) return null;
    return { ladoDireito: o.ladoDireito, yFrac: Math.min(1, Math.max(0, o.yFrac)) };
  } catch {
    return null;
  }
}

/** Posição em pixels (x,y), sempre dentro dos limites. */
export function posParaPx(pos: FabPos | null, l: FabLimites): { x: number; y: number } {
  const p = pos ?? { ladoDireito: true, yFrac: fracPadrao(l) };
  const y = l.minY + p.yFrac * (l.maxY - l.minY);
  return {
    x: p.ladoDireito ? l.xDir : l.xEsq,
    y: Math.min(l.maxY, Math.max(l.minY, Number.isFinite(y) ? y : l.maxY)),
  };
}

export function pxParaPos(x: number, y: number, l: FabLimites, tamanho: number): FabPos {
  const faixa = l.maxY - l.minY;
  const yc = Math.min(l.maxY, Math.max(l.minY, y));
  return {
    ladoDireito: x + tamanho / 2 > (l.xEsq + l.xDir + tamanho) / 2,
    yFrac: faixa > 0 ? (yc - l.minY) / faixa : 1,
  };
}
