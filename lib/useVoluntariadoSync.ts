import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { useFocusEffect } from "expo-router";
import { supabase } from "./supabase";
import { canaisObsoletos, topicoVoluntariado } from "./canalRealtime";
import { getVoluntariadoMe, type VoluntariadoMe } from "./api";

/**
 * Mantém a tela de Voluntariado sincronizada com a fonte da verdade:
 * **`GET /app/voluntariado/me`**.
 *
 * ⚠⚠ ANTES ELE LIA AS TABELAS DIRETO, E ISSO ERA O BUG (11/08/2026).
 *
 * Relato do Marcos: *"Pedro Fernandes, nosso responsável da produção que está
 * escalado em todos os cultos, ao abrir o app e entrar em servir apareceu as
 * áreas para ele escolher e o pedido de quero ser voluntário."*
 *
 * A causa: `voluntario_ativo` vinha de **`mem_membros.voluntario`**, lida aqui
 * direto da tabela — e essa coluna é `true` em **0 de 4.072** membros vivos
 * (medido). Ou seja, o único sinal de "esta pessoa está no time" era
 * **sempre false pra todo mundo**, e quem não tinha linha em `vol_inscricoes`
 * caia no formulário. O Pedro tem **57 escalas** e **zero inscrição** — ele
 * nunca precisou se inscrever, já servia.
 *
 * ⚠️ O servidor SEMPRE soube a resposta: `resolverVolProfile` (`app.js`, do
 * Matheus · 25/06) resolve o perfil por auth_user_id → CPF → membresia_id →
 * e-mail e já devolve `voluntario_ativo` em `/app/voluntariado/me`. O perfil do
 * Pedro está vinculado e não arquivado. **A tela só nunca perguntou.**
 *
 * ⚠⚠ E ERAM DUAS VERDADES NO MESMO APP: `lib/jornada.ts` e
 * `lib/inscricoesStatus.ts` já chamavam `getVoluntariadoMe()` — então a Jornada
 * e o hub de Inscrições mostravam o Pedro como quem serve, enquanto a aba Servir
 * oferecia a ele "quero ser voluntário". É a mesma divergencia que a régua
 * `lib/volStatus.ts` matou em 05/08 — a RÉGUA foi unificada, a FONTE não.
 *
 * ⇒ LEI DA CASA, de novo: quem decide o que é válido é o BACKEND. O app lê
 * tabela direto só pro que é dado DELE; régua de negócio vem de endpoint.
 *
 * Combina foco da tela, AppState e realtime em `vol_inscricoes` (o realtime
 * segue útil: aceitar o voluntário no web dispara o refetch **do endpoint**).
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
    // ⚠⚠ AQUI TINHA UM CURTO-CIRCUITO: conta sem `membro_id` respondia
    // `voluntario_ativo: false` SEM PERGUNTAR ao servidor. Mas o servidor resolve
    // o perfil de voluntário por **auth_user_id e e-mail** também — ele não
    // precisa do `membro_id`. Medido: 21 das 125 contas não têm `membro_id`, e
    // **1 delas tem perfil de voluntário vivo com 5 escalas**. Essa pessoa via o
    // formulário por uma decisão tomada no cliente, sobre um dado que o cliente
    // não tem. Agora sempre pergunta; só `undefined` (pai ainda carregando)
    // segura, pra não piscar o formulário antes da resposta.
    try {
      // ⚠️ UMA chamada, e ela já traz `inscricao` E `voluntario_ativo` — o
      // servidor resolve o perfil de voluntário (auth_user_id → CPF →
      // membresia_id → e-mail) e filtra o soft-delete da inscrição. As duas
      // consultas que moravam aqui reproduziam metade dessa régua e erravam a
      // outra metade.
      const resp = await getVoluntariadoMe();
      if (ativo.current) {
        setMe(resp);
        setErro(null);
      }
    } catch (e) {
      // ⚠️ Falha de rede NÃO pode virar "você não é voluntário": isso mostraria
      // o formulário de inscrição a quem já serve, que é o estado enganoso que
      // esta correção existe pra matar. `me` fica como estava (null na 1ª
      // abertura) e a tela mostra o erro com "tentar de novo".
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
