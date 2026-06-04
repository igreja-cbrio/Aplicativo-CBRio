import { useCallback, useEffect, useState } from "react";
import { useFocusEffect } from "expo-router";
import { supabase } from "./supabase";
import { useAuth } from "@/contexts/AuthContext";

export type AppNotificacao = {
  id: string;
  user_id: string;
  tipo: string;
  titulo: string;
  body: string;
  data: Record<string, unknown>;
  lida_em: string | null;
  criada_em: string;
};

/** Lista as notificações do usuário (mais recentes primeiro). */
export function useNotificacoes() {
  const { user } = useAuth();
  const [itens, setItens] = useState<AppNotificacao[]>([]);
  const [loading, setLoading] = useState(true);

  const carregar = useCallback(async () => {
    if (!user?.id) {
      setItens([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from("app_notificacoes")
      .select("*")
      .eq("user_id", user.id)
      .order("criada_em", { ascending: false })
      .limit(100);
    setItens((data as AppNotificacao[]) ?? []);
    setLoading(false);
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      carregar();
    }, [carregar])
  );

  const marcarLida = useCallback(
    async (id: string) => {
      await supabase
        .from("app_notificacoes")
        .update({ lida_em: new Date().toISOString() })
        .eq("id", id)
        .is("lida_em", null);
      setItens((arr) =>
        arr.map((n) => (n.id === id && !n.lida_em ? { ...n, lida_em: new Date().toISOString() } : n))
      );
    },
    []
  );

  const marcarTodasLidas = useCallback(async () => {
    if (!user?.id) return;
    const agora = new Date().toISOString();
    await supabase
      .from("app_notificacoes")
      .update({ lida_em: agora })
      .eq("user_id", user.id)
      .is("lida_em", null);
    setItens((arr) => arr.map((n) => (n.lida_em ? n : { ...n, lida_em: agora })));
  }, [user?.id]);

  return { itens, loading, carregar, marcarLida, marcarTodasLidas };
}

/** Hook leve só pra contagem de não-lidas (pra badge do sino). */
export function useNotificacoesNaoLidas(intervaloMs = 30000) {
  const { user } = useAuth();
  const [count, setCount] = useState(0);

  const carregar = useCallback(async () => {
    if (!user?.id) {
      setCount(0);
      return;
    }
    const { count: c } = await supabase
      .from("app_notificacoes")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .is("lida_em", null);
    setCount(c ?? 0);
  }, [user?.id]);

  useEffect(() => {
    carregar();
    const t = setInterval(carregar, intervaloMs);
    return () => clearInterval(t);
  }, [carregar, intervaloMs]);

  return { count, recarregar: carregar };
}
