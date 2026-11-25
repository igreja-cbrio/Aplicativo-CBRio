export type TutorialStatus = 'pending' | 'done';
type Storage = { getItem(key: string): Promise<string | null>; setItem(key: string, value: string): Promise<void> };
export const tutorialKey = (userId: string) => `cbrio:tutorial:v1:${userId}`;
const concluidosNestaSessao = new Set<string>();
const MIGRACAO = 'cbrio:tutorial:legacy-owner:v1';
let preparacao: Promise<unknown> = Promise.resolve();

/** Migra a apresentação antiga sem impor outro tour a quem já usa este aparelho. */
export function prepararTutorial(storage: Storage, userId: string): Promise<TutorialStatus> {
  const result = preparacao.then(() => preparar(storage, userId));
  preparacao = result.catch(() => {});
  return result;
}

async function preparar(storage: Storage, userId: string): Promise<TutorialStatus> {
  if (concluidosNestaSessao.has(userId)) return 'done';
  try {
    const saved = await storage.getItem(tutorialKey(userId));
    if (saved === 'pending' || saved === 'done') return saved;
    const legacy = await storage.getItem('cbrio:onboarding_visto:v1') === 'true';
    const owner = legacy ? await storage.getItem(MIGRACAO) : null;
    const status = legacy && (!owner || owner === userId) ? 'done' : 'pending';
    if (legacy && !owner) await storage.setItem(MIGRACAO, userId);
    await storage.setItem(tutorialKey(userId), status);
    return status;
  } catch { return 'done'; }
}

export async function concluirTutorial(storage: Storage, userId: string): Promise<void> {
  concluidosNestaSessao.add(userId);
  try { await storage.setItem(tutorialKey(userId), 'done'); } catch { /* memória evita insistir nesta sessão */ }
}

export type TutorialRect = { x: number; y: number; width: number; height: number };
export function recorteTutorial(target: TutorialRect, host: TutorialRect): TutorialRect | null {
  if (![...Object.values(target), ...Object.values(host)].every(Number.isFinite) || target.width <= 0 || target.height <= 0) return null;
  const x = Math.max(0, target.x - host.x - 4), y = Math.max(0, target.y - host.y - 4);
  const right = Math.min(host.width, target.x - host.x + target.width + 4);
  const bottom = Math.min(host.height, target.y - host.y + target.height + 4);
  return right > x && bottom > y ? { x, y, width: right - x, height: bottom - y } : null;
}

export function podeMostrarTutorial(input: { pending: boolean; ready: boolean; pushReady: boolean; cadastroReady: boolean; home: boolean; focused: boolean; active: boolean; menuOpen: boolean }) {
  return input.pending && input.ready && input.pushReady && input.cadastroReady && input.home && input.focused && input.active && !input.menuOpen;
}

/** Mesmo contorno arredondado no recorte e no anel; sem cantos quadrados. */
export function contornoTutorial({ x, y, width, height }: TutorialRect): string {
  const r = Math.min(width, height) / 2;
  return `M${x + r} ${y}H${x + width - r}A${r} ${r} 0 0 1 ${x + width} ${y + r}V${y + height - r}A${r} ${r} 0 0 1 ${x + width - r} ${y + height}H${x + r}A${r} ${r} 0 0 1 ${x} ${y + height - r}V${y + r}A${r} ${r} 0 0 1 ${x + r} ${y}Z`;
}
