import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { useFocusEffect } from "expo-router";
import { supabase } from "./supabase";
import { getVoluntariadoMe, type VoluntariadoMe } from "./api";

/**
 * Mantém a tela de Voluntariado sincronizada com o status real da inscrição.
 *
 * Combina:
 *  - GET /app/voluntariado/me no mount + foco da tela + AppState foreground
 *  - polling leve a cada 30s enquanto a tela está visível
 *  - subscription realtime em vol_inscricoes (filtrada pelo membro) — quando
 *    a coordenação muda o status, a tela re-fetch imediatamente
 *
 * Returns:
 *   me     -> resposta atual (null enquanto carrega)
 *   loading -> true só na 1ª carga
 *   recarregar -> força um refetch manual
 */
export function useVoluntariadoSync(membroId: string | null | undefined) {
  const [me, setMe] = useState<VoluntariadoMe | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const ativo = useRef(true);

  const recarregar = useCallback(async () => {
    try {
      const dados = await getVoluntariadoMe();
      if (ativo.current) {
        setMe(dados);
        setErro(null);
      }
    } catch (e) {
      if (ativo.current) setErro(e instanceof Error ? e.message : "Falha ao carregar.");
    } finally {
      if (ativo.current) setLoading(false);
    }
  }, []);

  // 1) Refetch ao focar a tela
  useFocusEffect(
    useCallback(() => {
      ativo.current = true;
      recarregar();
      return () => {
        ativo.current = false;
      };
    }, [recarregar])
  );

  // 2) Refetch quando o app volta pro foreground
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") recarregar();
    });
    return () => sub.remove();
  }, [recarregar]);

  // 3) Polling leve enquanto a tela está ativa
  useEffect(() => {
    const t = setInterval(() => {
      if (ativo.current) recarregar();
    }, 30000);
    return () => clearInterval(t);
  }, [recarregar]);

  // 4) Realtime — Postgres Changes em vol_inscricoes filtrado pelo membro
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
