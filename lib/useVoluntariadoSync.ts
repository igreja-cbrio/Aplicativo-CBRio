import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { useFocusEffect } from "expo-router";
import { supabase } from "./supabase";
import { type VoluntariadoMe } from "./api";

/**
 * Mantém a tela de Voluntariado sincronizada com a fonte da verdade
 * (vol_inscricoes + mem_membros.voluntario), consultando direto pelo
 * Supabase. Combina foco da tela, AppState, polling leve e realtime.
 */
export function useVoluntariadoSync(membroId: string | null | undefined) {
  const [me, setMe] = useState<VoluntariadoMe | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const ativo = useRef(true);

  const recarregar = useCallback(async () => {
    if (!membroId) {
      setMe({ inscricao: null, voluntario_ativo: false });
      setLoading(false);
      return;
    }
    try {
      // 1) Inscrição mais recente (ativa) do membro em vol_inscricoes.
      const { data: insRow } = await supabase
        .from("vol_inscricoes")
        .select("id, status, area, ministerios_interesse, integrado_em")
        .eq("membro_id", membroId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      // 2) Flag voluntario do membro (sinaliza ativo mesmo sem inscrição
      //    recente, ex.: voluntário antigo importado via backfill).
      const { data: m } = await supabase
        .from("mem_membros")
        .select("voluntario")
        .eq("id", membroId)
        .maybeSingle();

      if (ativo.current) {
        setMe({
          inscricao: insRow
            ? {
                id: insRow.id as string,
                status: insRow.status as string,
                area: (insRow.area as string) ?? null,
                ministerios_interesse:
                  (insRow.ministerios_interesse as string[] | null) ?? null,
                integrado_em: (insRow.integrado_em as string | null) ?? null,
              }
            : null,
          voluntario_ativo: !!(m as { voluntario?: boolean } | null)?.voluntario,
        });
        setErro(null);
      }
    } catch (e) {
      if (ativo.current) setErro(e instanceof Error ? e.message : "Falha ao carregar.");
    } finally {
      if (ativo.current) setLoading(false);
    }
  }, [membroId]);

  // Refetch ao focar a tela
  useFocusEffect(
    useCallback(() => {
      ativo.current = true;
      recarregar();
      return () => {
        ativo.current = false;
      };
    }, [recarregar])
  );

  // Refetch quando o app volta pro foreground
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") recarregar();
    });
    return () => sub.remove();
  }, [recarregar]);

  // Polling leve
  useEffect(() => {
    const t = setInterval(() => {
      if (ativo.current) recarregar();
    }, 30000);
    return () => clearInterval(t);
  }, [recarregar]);

  // Realtime — Postgres Changes em vol_inscricoes filtrado pelo membro
  useEffect(() => {
    if (!membroId) return;
    const canal = supabase
      .channel(`voluntariado-${membroId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "vol_inscricoes",
          filter: `membro_id=eq.${membroId}`,
        },
        () => recarregar()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(canal);
    };
  }, [membroId, recarregar]);

  return { me, loading, erro, recarregar };
}
