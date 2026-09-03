// Tipos da catraca do binário da loja (`scripts/driftLoja.js`).
// ⚠️ O `tsconfig.json` inclui `**/*.ts`, então este arquivo é o que deixa
// `test/driftLoja.test.ts` importar a régua sem `tsc` reclamar de módulo sem
// declaração. A implementação é CJS de propósito: `scripts/ota.js` a consome, e
// ele roda por `node` direto, sem passar por bundler.

export type NivelDrift = 'ok' | 'aviso' | 'bloqueio' | 'desconhecido';

export interface Limites {
  avisoDias: number;
  avisoCommits: number;
  bloqueioDias: number;
  bloqueioCommits: number;
}

export interface EntradaDrift {
  diasAtras?: number | null;
  commitsAtras?: number | null;
  /** `null` = não deu pra conferir (fail-open: não bloqueia). */
  mudouNativo?: boolean | null;
}

export interface VeredictoDrift {
  nivel: NivelDrift;
  motivos: string[];
}

export interface ParesNativos {
  pkgAntes?: unknown;
  pkgAgora?: unknown;
  appAntes?: unknown;
  appAgora?: unknown;
}

export interface LinhaRelatorio extends VeredictoDrift {
  plataforma: string;
  publicado: Record<string, unknown> | null;
  commitBase: string | null;
  diasAtras: number | null;
  commitsAtras: number | null;
  itensNativos: string[];
}

export const LIMITES: Limites;
export function avaliarDrift(e: EntradaDrift, limites?: Limites): VeredictoDrift;
export function diffNativo(p: ParesNativos): string[];
export function avaliarLojas(
  raiz: string,
  limites?: Limites,
): { nivel: NivelDrift; relatorio: LinhaRelatorio[]; ledgerAusente: boolean };
export function relatar(raiz: string, limites?: Limites): NivelDrift;
