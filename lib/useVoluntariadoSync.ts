import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { useFocusEffect } from "expo-router";
import { supabase } from "./supabase";
import { canaisObsoletos, topicoVoluntariado } from "./canalRealtime";
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
    // undefined = pai ainda carregando o membro -> não toca em nada
    if (membroId === undefined) {
      return;
    }
    // null = membro carregado mas sem vínculo -> sem inscrição
    if (membroId === null) {
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
        // Soft-delete de `vol_inscricoes` foi criado em 28/07 (M6a) e LIBERADO
        // em M6b — inscrição apagada pela equipe não pode continuar valendo
        // como ativa no app (e bloqueando nova inscrição).
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      // 2) Flag voluntario do membro (sinaliza ativo mesmo sem inscrição
      //    recente, ex.: voluntário antigo importado via backfill).
      const { data: m } = await supabase
        .from("mem_membros")
        .select("voluntario")
        .eq("id", membroId)
        .is("deleted_at", null)
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

  // (Sem polling: o realtime abaixo já cobre mudanças em vol_inscricoes;
  //  o setInterval de 30s era redundante e gerava carga no Supabase.)

  // Realtime — Postgres Changes em vol_inscricoes filtrado pelo membro
  //
  // ⚠️⚠️ ISTO DERRUBAVA A ABA SERVIR (07/08). Tópico FIXO + `removeChannel`
  // assíncrono faziam a 2ª montagem reencontrar o canal ainda registrado, e o
  // `.on()` do supabase-js LANÇA em canal joined/joining. O throw subia do
  // efeito até a raiz e a pessoa via "Algo deu errado". Detalhes e as 3 causas
  // do supabase-js em `lib/canalRealtime.ts`.
  useEffect(() => {
    if (!membroId) return;
    let canal: ReturnType<typeof supabase.channel> | null = null;
    try {
      // 1) Enterra canais órfãos deste membro (o cleanup anterior pode não ter
      //    completado ainda) — senão o tópico único só empilha canais.
      const registrados = supabase.getChannels();
      for (const topico of canaisObsoletos(registrados.map((c) => c.topic), membroId)) {
        const velho = registrados.find((c) => c.topic === topico);
        if (velho) supabase.removeChannel(velho);
      }
      // 2) Tópico NOVO: garante que `.channel()` cria em vez de reaproveitar.
      canal = supabase
        .channel(topicoVoluntariado(membroId))
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
    } catch (e) {
      // ⚠️ Realtime aqui é CONVENIÊNCIA (aceitar o voluntário no web aparecer
      // em segundos). O refetch por foco e por AppState acima já cobre o dado.
      // Falha dele NUNCA pode derrubar a tela — foi exatamente isso que
      // aconteceu. Sem o catch, qualquer mudança futura do supabase-js volta a
      // trocar "a lista atualiza sozinha" por "o app quebrou".
      console.warn("[voluntariado] realtime indisponível:", e);
      canal = null;
    }
    return () => {
      if (canal) supabase.removeChannel(canal);
    };
  }, [membroId, recarregar]);

  return { me, loading, erro, recarregar };
}
