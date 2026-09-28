import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { useFocusEffect } from "expo-router";
import { getNextMe, type NextMe } from "./api";
import {captureCampusSession} from "./campusSession";
import {nextContextoMudou,nextErroExigeLimpeza} from "./nextCampus";

/** Mantém a aba NEXT sincronizada: refetch ao focar, foreground e a cada 120s. */
export function useNextSync() {
  const [me, setMe] = useState<NextMe | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const ativo = useRef(true);
  const ultima=useRef(0);

  const recarregar = useCallback(async () => {
    const turno=++ultima.current;
    const scope=captureCampusSession();
    try {
      const dados = await getNextMe();
      scope.assertCurrent();
      if (ativo.current && turno===ultima.current) {
        setMe(dados);
        setErro(null);
      }
    } catch (e) {
      if (ativo.current && turno===ultima.current) {
        if(nextErroExigeLimpeza(e)) setMe(null);
        if(!nextContextoMudou(e)) setErro(e instanceof Error ? e.message : "Falha ao carregar.");
      }
    } finally {
      scope.release();
      if (ativo.current && turno===ultima.current) setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      ativo.current = true;
      recarregar();
      return () => {
        ativo.current = false;
      };
    }, [recarregar])
  );

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") recarregar();
    });
    return () => sub.remove();
  }, [recarregar]);

  // Polling leve (NEXT não tem realtime). 120s pra reduzir carga no Supabase.
  useEffect(() => {
    const t = setInterval(() => {
      if (ativo.current) recarregar();
    }, 120000);
    return () => clearInterval(t);
  }, [recarregar]);

  return { me, loading, erro, recarregar };
}
