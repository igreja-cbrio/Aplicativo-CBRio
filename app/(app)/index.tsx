import { meuBatismo, type MeuBatismo } from "@/lib/batismo";
import { contagemBatismo } from "@/lib/batismoContagem";
import { useRelogioBatismo } from "@/lib/useRelogioBatismo";
import { useCallback, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { MarketingHero, type HomeNotice } from "@/components/home/MarketingHero";
import { useAtualizacaoManual } from "@/components/app/PortaoAtualizacao";
import { apiGet } from "@/lib/api";
import { streakDevocional } from "@/lib/devocional";
import { useNotificacoesNaoLidas } from "@/lib/useNotificacoes";
import { useMembro } from "@/lib/useMembro";
import { useT } from "@/lib/i18n";
import { DESTINO_AVISOS } from "@/lib/menuRegras";

export default function InicioScreen() {
  const { membro } = useMembro(), { count } = useNotificacoesNaoLidas(), t = useT();
  const agora = useRelogioBatismo();
  const [batismo, setBatismo] = useState<{ membroId: string; inscricao: MeuBatismo } | null>(null);
  const atualizarApp = useAtualizacaoManual();
  const ativa = useRef(false);
  useFocusEffect(useCallback(() => { ativa.current = true; return () => { ativa.current = false; }; }, []));
  const [avisos, setAvisos] = useState<{ id: string; titulo: string; corpo: string }[]>([]);
  const [streak, setStreak] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const carregar = useCallback(async (active: () => boolean = () => true) => {
    const [result, dias, inscricao] = await Promise.all([
      apiGet<{ comunicados: { id: string; titulo: string; corpo: string }[] }>("/app/comunicados").catch(() => null),
      membro?.membroId ? streakDevocional(membro.membroId).catch(() => null) : Promise.resolve(null),
      membro?.membroId ? meuBatismo(membro.membroId).catch(() => null) : Promise.resolve(null),
    ]);
    if (!active()) return;
    if (result) setAvisos(result.comunicados || []);
    setStreak(dias);
    setBatismo(inscricao && membro?.membroId ? { membroId: membro.membroId, inscricao } : null);
  }, [membro?.membroId]);
  useFocusEffect(useCallback(() => { let active = true; void carregar(() => active); return () => { active = false; }; }, [carregar]));
  const contagem = batismo?.membroId === membro?.membroId && batismo
    ? contagemBatismo(batismo.inscricao, agora) : null;
  const avisoBatismo: HomeNotice[] = contagem && (contagem.estado === 'agendado' || contagem.estado === 'hoje') ? [{
    id: "meu-batismo", href: "/batismo", count: contagem.dias || undefined,
    title: contagem.estado === 'hoje' ? t("Seu batismo é hoje!") : t("Seu batismo está chegando!"),
    body: contagem.estado === 'hoje' ? t("Vamos celebrar esse dia com você.")
      : contagem.dias === 0 ? t("Falta menos de um dia para esse novo começo.")
      : `${contagem.dias} ${contagem.dias === 1 ? t("dia para esse novo começo.") : t("dias para esse novo começo.")}`,
  }] : [];
  const notices: HomeNotice[] = [
    ...avisoBatismo,
    { id: "devocional", title: t("Não perca seu streak diário na devocional de Quarta com Deus!"), count: streak ?? undefined, href: "/devocional" },
    ...avisos.slice(0, 5).map((a) => ({ id: a.id, title: a.titulo, body: a.corpo, href: DESTINO_AVISOS })),
  ];
  return <View style={styles.screen}>
    <MarketingHero notices={notices} unreadCount={count} refreshing={refreshing} onRefresh={async () => {
      if (refreshing) return;
      setRefreshing(true);
      try { await Promise.all([carregar(() => ativa.current), atualizarApp(() => ativa.current)]); }
      finally { setRefreshing(false); }
    }} />
  </View>;
}
const styles = StyleSheet.create({ screen: { flex: 1, backgroundColor: "#314b51" } });
