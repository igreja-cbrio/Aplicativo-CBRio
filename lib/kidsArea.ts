// Dados da KIDS (mural, eventos, horários, salas) — uma chamada só, compartilhada
// pelas 4 telas-filha. Cache SWR (lib/cache.ts) pra não repetir o fetch a cada tela.
import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import { apiGet } from "@/lib/api";
import { cacheSWR } from "@/lib/cache";

export type Mural = { id: string; titulo: string; corpo: string; destaque: boolean; publicado_em: string | null };
export type Evento = { id: string; titulo: string; descricao: string | null; data: string | null; hora: string | null; local: string | null; destaque: boolean };
export type Horario = { id: string; rotulo: string; descricao: string | null; ordem: number };
export type Sala = { id: string; nome: string; faixa: string | null; cor: string | null; logo_url: string | null };
export type KidsArea = { mural: Mural[]; eventos: Evento[]; horarios: Horario[]; salas: Sala[] };

export const ROSA = "#E85D9A";

/** "2026-11-15" (dia civil, sem fuso) → "15/11/2026". Nunca passa por Date/UTC. */
export function dataBR(d: string | null): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d || "");
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
}
/** "09:30:00" → "09:30". */
export function horaCurta(h: string | null): string {
  const m = /^(\d{2}):(\d{2})/.exec(h || "");
  return m ? `${m[1]}:${m[2]}` : "";
}
export function corValida(c: string | null): string {
  return c && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(c.trim()) ? c.trim() : ROSA;
}

async function buscarArea(): Promise<KidsArea> {
  const r = await apiGet<KidsArea>("/app/kids/area");
  return { mural: r?.mural || [], eventos: r?.eventos || [], horarios: r?.horarios || [], salas: r?.salas || [] };
}

/** Carrega a KIDS ao focar a tela; `recarregar` ignora o cache (pull-to-refresh/retry). */
export function useKidsArea() {
  const [area, setArea] = useState<KidsArea | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [falhou, setFalhou] = useState(false);

  const carregar = useCallback(async (forcar = false) => {
    try {
      setArea(await cacheSWR("kids-area", buscarArea, { forcar, ttlMs: 2 * 60 * 1000 }));
      setFalhou(false);
    } catch {
      setFalhou(true);
    } finally {
      setCarregando(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { carregar(); }, [carregar]));

  return {
    area, carregando, refreshing, falhou,
    recarregar: () => { setRefreshing(true); carregar(true); },
    tentarDeNovo: () => { setCarregando(true); carregar(true); },
  };
}
