import { useCallback, useEffect, useMemo, useState } from "react";
import { BRAND_FONT } from "@/lib/fonts";
import { HeartRefresh } from "@/components/anim/HeartRefresh";
import { HeartPulseOverlay } from "@/components/anim/HeartPulse";
import { Skeleton } from "@/components/anim/Skeleton";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { ScreenBackground } from "@/components/ui/ScreenBackground";
import { useFocusEffect, useRouter, usePathname } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { MarketingHero, type HomeNotice } from "@/components/home/MarketingHero";
import { apiGet } from "@/lib/api";
import { streakDevocional } from "@/lib/devocional";
import { useNotificacoesNaoLidas } from "@/lib/useNotificacoes";
import { StatusBar } from "expo-status-bar";
import { useColors } from "@/contexts/ThemeContext";
import { useMembro } from "@/lib/useMembro";
import { useT } from "@/lib/i18n";
import { destaquesAtivos, type Destaque } from "@/lib/destaques";
import { proximosCultos, cultoAoVivo, type CultoUpcoming, type CultoAoVivo } from "@/lib/cultos";
import { Carrossel } from "@/components/home/Carrossel";
import { CardKidsCheckin } from "@/components/home/CardKidsCheckin";
import { ProximosCultos } from "@/components/home/ProximosCultos";
import { AnimatedShortcut } from "@/components/anim/AnimatedShortcut";
import { font, radius, spacing, type Palette } from "@/constants/theme";
import { quebrarAposPrimeiraPalavra } from "@/lib/rotuloAtalho";

type Atalho = {
  label: string;
  /** Força "primeira palavra" / "resto" no rótulo. Ver lib/rotuloAtalho. */
  duasLinhas?: true;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  href:
    | "/generosidade" | "/batismo" | "/kids" | "/jornada" | "/next" | "/inscricoes"
    | "/videos" | "/grupos" | "/meu-grupo" | "/voluntariado" | "/apresentacao-crianca"
    | "/conteudos";
};

// Atalhos complementares preservados abaixo da abertura do marketing.
const ATALHOS: Atalho[] = [
  // Grupos mantém o mesmo destino da navegação principal.
  { label: "Grupos", icon: "people", href: "/meu-grupo" },
  { label: "NEXT", icon: "sparkles", href: "/next" },
  { label: "Voluntariado", icon: "hand-left", href: "/voluntariado" },
  { label: "Batismo", icon: "water", href: "/batismo" },
  // ⚠️⚠️ `duasLinhas` FORÇA "Apresentação" / "de crianças" (pedido do Matheus em
  // 26/08, refeito em 27/08). A 1ª tentativa usou espaço inquebrável e ele
  // voltou dizendo que NÃO MUDOU NADA — estava certo: NBSP não força quebra, só
  // impede. O porquê completo está em lib/rotuloAtalho.ts. A chave de i18n volta
  // a ter espaço COMUM, porque quebra é layout e não tradução.
  { label: "Apresentação de crianças", icon: "happy", href: "/apresentacao-crianca", duasLinhas: true },
  { label: "Inscrições", icon: "clipboard", href: "/inscricoes" },
  { label: "Conteúdos", icon: "library", href: "/conteudos" },
];

export default function InicioScreen() {
  const { membro } = useMembro();
  const { count: unreadCount } = useNotificacoesNaoLidas();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const router = useRouter();
  const t = useT();
  const [destaques, setDestaques] = useState<Destaque[]>([]);
  const [cultos, setCultos] = useState<CultoUpcoming[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [avisos, setAvisos] = useState<{ id: string; titulo: string; corpo: string }[]>([]);
  const [streak, setStreak] = useState<number | null>(null);
  const [aoVivo, setAoVivo] = useState<CultoAoVivo | null>(null);

  const carregar = useCallback(async (forcar = false) => {
    const [d, c, v, a] = await Promise.all([
      destaquesAtivos(forcar).catch(() => []),
      proximosCultos(7, forcar).catch(() => []),
      // ⚠️ SEM cache: "está ao vivo agora?" é a pergunta mais perecível da
      // tela — servir do cache mostraria o card depois do culto acabar.
      cultoAoVivo().catch(() => null),
      apiGet<{ comunicados: { id: string; titulo: string; corpo: string }[] }>("/app/comunicados").catch(() => null),
    ]);
    setDestaques(d);
    setCultos(c);
    setAoVivo(v);
    if (a) setAvisos(a.comunicados || []);
  }, []);

  useEffect(() => {
    setCarregando(true);
    carregar().finally(() => setCarregando(false));
  }, [carregar]);

  // Voltar pra Home durante o culto tem que mostrar o card (e, quando o culto
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
  useFocusEffect(useCallback(() => {
    let active = true;
    setStreak(null);
    if (membro?.membroId) streakDevocional(membro.membroId).then((n) => { if (active) setStreak(n); }).catch(() => {});
    return () => { active = false; };
  }, [membro?.membroId]));
  const notices: HomeNotice[] = [
    { id: "devocional", title: streak && streak > 0 ? t("Continue sua sequência de leitura") : t("Um tempo com Deus, todos os dias"), body: t("Abra seu devocional e renove sua fé."), count: streak ?? undefined, href: "/devocional" },
    ...avisos.slice(0, 5).map((a) => ({ id: a.id, title: a.titulo, body: a.corpo, href: "/noticias" as const })),
  ];

  return (
    <View style={styles.safe}>
      {pathname === "/" ? <StatusBar style="light" /> : null}
      <ScreenBackground />
      <HeartPulseOverlay visible={refreshing} />
      <ScrollView
        contentContainerStyle={{ paddingBottom: 32 }}
        refreshControl={<HeartRefresh refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <MarketingHero notices={notices} unreadCount={unreadCount} />
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


        {/* Atalhos para os módulos */}
        <Text style={styles.sectionTitle}>{t("Atalhos")}</Text>
        <View style={styles.grid}>
          {ATALHOS.map((a, i) => (
            <AnimatedShortcut
              key={a.href}
              index={i}
              style={styles.shortcut}
              onPress={() => router.navigate(a.href)}
              accessibilityRole="button"
              accessibilityLabel={t(a.label)}
            >
              <View style={styles.shortcutIcon}>
                <Ionicons name={a.icon} size={22} color={colors.brandMid} />
              </View>
              <Text style={styles.shortcutLabel} numberOfLines={2}>
                {a.duasLinhas ? quebrarAposPrimeiraPalavra(t(a.label)) : t(a.label)}
              </Text>
            </AnimatedShortcut>
          ))}
        </View>
        </SafeAreaView>
      </ScrollView>
      {/* Mantém contraste dos ícones do sistema ao rolar para o conteúdo claro. */}
      <View pointerEvents="none" style={{ position: "absolute", top: 0, left: 0, right: 0, height: insets.top, backgroundColor: "#49656b" }} />
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
      fontSize: font.size.lg,
      fontFamily: BRAND_FONT,
    },
    grid: {
      flexDirection: "row",
      flexWrap: "wrap",
      rowGap: spacing.lg,
    },
    shortcut: {
      width: "33.333%",
      alignItems: "center",
      gap: spacing.sm,
    },
    pressed: { opacity: 0.7 },
    shortcutIcon: {
      width: 60,
      height: 60,
      borderRadius: radius.md,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.glassBorder,
      alignItems: "center",
      justifyContent: "center",
      alignSelf: "center",
      // sombra suave pra dar profundidade (consistente em todo mount)
      shadowColor: "#0B1F26",
      shadowOpacity: 0.06,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 3 },
      elevation: 2,
    },
    shortcutLabel: {
      color: colors.text,
      fontSize: 13,
      fontWeight: "600",
      textAlign: "center",
      alignSelf: "center",
      width: "100%",
    },
  });
