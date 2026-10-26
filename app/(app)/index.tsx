import { useCallback, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MarketingHero, type HomeNotice } from "@/components/home/MarketingHero";
import { HeartRefresh } from "@/components/anim/HeartRefresh";
import { apiGet } from "@/lib/api";
import { streakDevocional } from "@/lib/devocional";
import { useNotificacoesNaoLidas } from "@/lib/useNotificacoes";
import { useMembro } from "@/lib/useMembro";
import { useT } from "@/lib/i18n";

export default function InicioScreen() {
  const { membro } = useMembro(), { count } = useNotificacoesNaoLidas(), t = useT();
  const insets = useSafeAreaInsets();
  const [avisos, setAvisos] = useState<{ id: string; titulo: string; corpo: string }[]>([]);
  const [streak, setStreak] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const carregar = useCallback(async (active: () => boolean = () => true) => {
    const [result, dias] = await Promise.all([
      apiGet<{ comunicados: { id: string; titulo: string; corpo: string }[] }>("/app/comunicados").catch(() => null),
      membro?.membroId ? streakDevocional(membro.membroId).catch(() => null) : Promise.resolve(null),
    ]);
    if (!active()) return;
    if (result) setAvisos(result.comunicados || []);
    setStreak(dias);
  }, [membro?.membroId]);
  useFocusEffect(useCallback(() => { let active = true; void carregar(() => active); return () => { active = false; }; }, [carregar]));
  const notices: HomeNotice[] = [
    { id: "devocional", title: t("Não perca seu streak diário na devocional de Quarta com Deus!"), count: streak ?? undefined, href: "/devocional" },
    ...avisos.slice(0, 5).map((a) => ({ id: a.id, title: a.titulo, body: a.corpo, href: "/noticias" as const })),
  ];
  return <View style={styles.screen}>
    <ScrollView showsVerticalScrollIndicator={false} refreshControl={<HeartRefresh refreshing={refreshing} onRefresh={async () => { setRefreshing(true); try { await carregar(); } finally { setRefreshing(false); } }} />}>
      <MarketingHero notices={notices} unreadCount={count} />
    </ScrollView>
    <View pointerEvents="none" style={{ position: "absolute", top: 0, left: 0, right: 0, height: insets.top, backgroundColor: "#49656b" }} />
  </View>;
}
const styles = StyleSheet.create({ screen: { flex: 1, backgroundColor: "#314b51" } });
