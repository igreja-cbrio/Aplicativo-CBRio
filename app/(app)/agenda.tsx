import { ScrollView } from "@/components/navigation/DockContent";
import { Text } from "@/components/ui/Typography";
import { useCallback, useEffect, useMemo, useState } from "react";
import { BRAND_FONT } from "@/lib/fonts";
import { HeartRefresh } from "@/components/anim/HeartRefresh";
import { HeartPulseOverlay } from "@/components/anim/HeartPulse";
import { Skeleton } from "@/components/anim/Skeleton";
import { Pressable, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ScreenBackground } from "@/components/ui/ScreenBackground";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useColors } from "@/contexts/ThemeContext";
import { useT } from "@/lib/i18n";
import { destaquesAtivos, type Destaque } from "@/lib/destaques";
import { proximosCultos, cultoAoVivo, type CultoUpcoming, type CultoAoVivo } from "@/lib/cultos";
import { Carrossel } from "@/components/home/Carrossel";
import { CardKidsCheckin } from "@/components/home/CardKidsCheckin";
import { ProximosCultos } from "@/components/home/ProximosCultos";
import { font, radius, spacing, type Palette } from "@/constants/theme";

export default function AgendaScreen() {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const router = useRouter();
  const t = useT();
  const [destaques, setDestaques] = useState<Destaque[]>([]);
  const [cultos, setCultos] = useState<CultoUpcoming[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [aoVivo, setAoVivo] = useState<CultoAoVivo | null>(null);

  const carregar = useCallback(async (forcar = false) => {
    const [d, c, v] = await Promise.all([
      destaquesAtivos(forcar).catch(() => []),
      proximosCultos(7, forcar).catch(() => []),
      // ⚠️ SEM cache: "está ao vivo agora?" é a pergunta mais perecível da
      // tela — servir do cache mostraria o card depois do culto acabar.
      cultoAoVivo().catch(() => null),
    ]);
    setDestaques(d);
    setCultos(c);
    setAoVivo(v);
  }, []);

  useEffect(() => {
    setCarregando(true);
    carregar().finally(() => setCarregando(false));
  }, [carregar]);

  // Voltar pra agenda durante o culto tem que mostrar o card (e, quando o culto
  // acaba, escondê-lo) — sem depender de pull-to-refresh.
  useFocusEffect(
    useCallback(() => {
      cultoAoVivo().then(setAoVivo).catch(() => {});
    }, [])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await carregar(true); // pull-to-refresh ignora o cache
    setRefreshing(false);
  }, [carregar]);

  return (
    <View style={styles.safe}>
      <ScreenBackground />
      <HeartPulseOverlay visible={refreshing} />
      <ScrollView
        contentContainerStyle={{ paddingBottom: 32 }}
        refreshControl={<HeartRefresh refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <Text accessibilityRole="header" style={[styles.sectionTitle, { paddingHorizontal: 24, paddingTop: 24 }]}>{t("Agenda e destaques")}</Text>
        <SafeAreaView edges={["left", "right"]} style={styles.content}>

        {/* AO VIVO — só durante o culto (ponto 2 do Marcos: o "No culto" saiu
            do menu e aparece aqui, na hora em que serve pra algo). */}
        {aoVivo?.ao_vivo && (
          <Pressable
            onPress={() => router.navigate("/modo-culto")}
            style={({ pressed }) => [styles.aoVivo, pressed && { opacity: 0.85 }]}
            accessibilityRole="button"
            accessibilityLabel={t("Estamos ao vivo · entrar no culto")}
          >
            <View style={styles.aoVivoDot} />
            <View style={{ flex: 1 }}>
              <Text style={styles.aoVivoTitulo}>{t("Estamos ao vivo")}</Text>
              <Text style={styles.aoVivoSub} numberOfLines={1}>
                {aoVivo.culto?.nome || t("Culto da CBRio")}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#fff" />
          </Pressable>
        )}

        {/* KIDS — só no dia em que há culto com Kids e a pessoa tem filho lá.
            Pedido do Matheus (29/08): o pré-check-in existia e ninguém achava
            (1 uso na história × 888 check-ins no totem em 30 dias). A condição
            sai de `cultos`, que esta tela já carregou. */}
        <CardKidsCheckin cultos={cultos} />

        {carregando ? (
          <Skeleton width="100%" height={180} borderRadius={20} />
        ) : (
          destaques.length > 0 && <Carrossel itens={destaques} />
        )}

        {carregando ? (
          <View style={{ gap: spacing.sm }}>
            <Skeleton width={160} height={18} borderRadius={6} />
            <View style={{ flexDirection: "row", gap: spacing.sm }}>
              <Skeleton width={220} height={140} borderRadius={20} />
              <Skeleton width={220} height={140} borderRadius={20} />
            </View>
          </View>
        ) : (
          <ProximosCultos cultos={cultos} />
        )}


        </SafeAreaView>
      </ScrollView>
    </View>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: "transparent" },
    content: { padding: spacing.lg, paddingBottom: 40, gap: spacing.lg },
    aoVivo: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      backgroundColor: "#E11D48",
      borderRadius: radius.lg,
      padding: spacing.md,
    },
    aoVivoDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: "#fff" },
    aoVivoTitulo: { color: "#fff", fontSize: font.size.lg, fontWeight: "800" },
    aoVivoSub: { color: "rgba(255,255,255,0.9)", fontSize: font.size.sm },
    sectionTitle: {
      color: colors.text,
      fontSize: 30,
      fontFamily: BRAND_FONT,
    },
  });
