// Conteúdo segmentado: revalida acesso a cada foco, sem cache persistente entre contas.
import { useCallback, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import { apiGet } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

export type Mural = { id: string; titulo: string; corpo: string; destaque: boolean; publicado_em: string | null; foto_url?: string | null };
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

/** Revalida vínculos e publicação ao focar ou atualizar a tela. */
export function useKidsArea() {
  const { user } = useAuth();
  const uid = user?.id;
  const generation = useRef(0);
  const [entry, setEntry] = useState<{ uid: string | undefined; data: KidsArea } | null>(null);
  const area = entry?.uid === uid ? entry?.data ?? null : null;
  const [carregando, setCarregando] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [falhou, setFalhou] = useState(false);

  const carregar = useCallback(async () => {
    const request = ++generation.current;
    try {
      const data = await buscarArea();
      if (request !== generation.current) return;
      setEntry({ uid, data });
      setFalhou(false);
    } catch {
      if (request !== generation.current) return;
      setEntry(null);
      setFalhou(true);
    } finally {
      if (request === generation.current) { setCarregando(false); setRefreshing(false); }
    }
  }, [uid]);

  useFocusEffect(useCallback(() => {
    setCarregando(true); setEntry(null); carregar();
    return () => { generation.current++; setEntry(null); };
  }, [carregar]));

  return {
    area, carregando, refreshing, falhou,
    recarregar: () => { setRefreshing(true); carregar(); },
    tentarDeNovo: () => { setCarregando(true); carregar(); },
  };
}
