import { useCallback, useEffect, useMemo, useState } from "react";
import { BRAND_FONT } from "@/lib/fonts";
import { HeartRefresh } from "@/components/anim/HeartRefresh";
import { HeartPulseOverlay } from "@/components/anim/HeartPulse";
import { Skeleton } from "@/components/anim/Skeleton";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ScreenBackground } from "@/components/ui/ScreenBackground";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/contexts/AuthContext";
import { useColors } from "@/contexts/ThemeContext";
import { useMembro } from "@/lib/useMembro";
import { useT } from "@/lib/i18n";
import { destaquesAtivos, type Destaque } from "@/lib/destaques";
import { proximosCultos, cultoAoVivo, type CultoUpcoming, type CultoAoVivo } from "@/lib/cultos";
import { FEATURES } from "@/lib/features";
import { Carrossel } from "@/components/home/Carrossel";
import { ProximosCultos } from "@/components/home/ProximosCultos";
import { AnimatedShortcut } from "@/components/anim/AnimatedShortcut";
import { font, radius, spacing, type Palette } from "@/constants/theme";

// ⚠️ O logo, o sino e a foto SAÍRAM daqui (04/08/2026): agora vivem na faixa
// superior global (components/ui/TopBar.tsx), que aparece igual em todas as
// telas de barra. Não recriar header local aqui — daria dois cabeçalhos.

function primeiroNome(nomeCompleto?: string, email?: string | null) {
  const nome = nomeCompleto?.trim();
  if (nome) return nome.split(/\s+/)[0];
  const local = (email ?? "").split("@")[0]?.split(/[._-]/)[0] ?? "";
  if (local) return local.charAt(0).toUpperCase() + local.slice(1);
  return "membro";
}

type Atalho = {
  label: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  href: "/generosidade" | "/batismo" | "/kids" | "/jornada" | "/next";
};

/**
 * ⚠️ Atalho aqui é SÓ pra o que não está na barra de baixo nem no menu —
 * pedido do Marcos (04/08/2026): "os itens que estejam no menu não sejam
 * atalhos". Saíram Devocional, Meu grupo, Servir, Cuidados e Inscrições
 * (os 4 primeiros estão na barra, sempre a um toque).
 * "No culto" também saiu: virou o CARD DE AO VIVO no topo, que só aparece
 * enquanto o culto está acontecendo.
 */
const ATALHOS: Atalho[] = [
  { label: "Sua jornada", icon: "trail-sign", href: "/jornada" },
  { label: "NEXT", icon: "sparkles", href: "/next" },
  { label: "Batismo", icon: "water", href: "/batismo" },
  { label: "Kids", icon: "happy", href: "/kids" },
  { label: "Generosidade", icon: "gift", href: "/generosidade" },
];

export default function InicioScreen() {
  const { user } = useAuth();
  const { membro } = useMembro();
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
  const nome = primeiroNome(
    membro?.nome || (user?.user_metadata?.nome as string | undefined),
    user?.email
  );

  return (
    <SafeAreaView style={styles.safe} edges={["left", "right"]}>
      <ScreenBackground />
      <HeartPulseOverlay visible={refreshing} />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<HeartRefresh refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <Text style={styles.hello}>{t("Olá")}, {nome}</Text>

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
          {ATALHOS.filter((a) => FEATURES.generosidade || a.href !== "/generosidade").map((a, i) => (
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
              <Text style={styles.shortcutLabel} numberOfLines={2}>{t(a.label)}</Text>
            </AnimatedShortcut>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
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
    hello: { color: colors.text, fontSize: font.size.xxl, fontFamily: BRAND_FONT, marginTop: spacing.md },
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
