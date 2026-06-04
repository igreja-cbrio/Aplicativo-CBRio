import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { useFocusEffect } from "expo-router";
import { getNextMe, type NextMe } from "./api";

/** Mantém a aba NEXT sincronizada: refetch ao focar, foreground e a cada 30s. */
export function useNextSync() {
  const [me, setMe] = useState<NextMe | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const ativo = useRef(true);

  const recarregar = useCallback(async () => {
    try {
      const dados = await getNextMe();
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

  useEffect(() => {
    const t = setInterval(() => {
      if (ativo.current) recarregar();
    }, 30000);
    return () => clearInterval(t);
  }, [recarregar]);

  return { me, loading, erro, recarregar };
}
