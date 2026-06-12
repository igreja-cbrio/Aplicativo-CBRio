import { useCallback, useEffect, useMemo, useState } from "react";
import { BRAND_FONT } from "@/lib/fonts";
import { HeartRefresh } from "@/components/anim/HeartRefresh";
import { HeartPulseOverlay } from "@/components/anim/HeartPulse";
import { Skeleton } from "@/components/anim/Skeleton";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ScreenBackground } from "@/components/ui/ScreenBackground";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { CbrioHeart } from "@/components/brand/CbrioHeart";
import { useAuth } from "@/contexts/AuthContext";
import { useColors, useTheme } from "@/contexts/ThemeContext";
import { useMembro } from "@/lib/useMembro";
import { useNotificacoesNaoLidas } from "@/lib/useNotificacoes";
import { useT } from "@/lib/i18n";
import { destaquesAtivos, type Destaque } from "@/lib/destaques";
import { proximosCultos, type CultoUpcoming } from "@/lib/cultos";
import { Carrossel } from "@/components/home/Carrossel";
import { ProximosCultos } from "@/components/home/ProximosCultos";
import { AnimatedShortcut } from "@/components/anim/AnimatedShortcut";
import { AnimatedBell } from "@/components/anim/AnimatedBell";
import { font, radius, spacing, type Palette } from "@/constants/theme";

const LOGO_WORDMARK = require("../../assets/images/cbrio-wordmark.png");

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
  href:
    | "/cuidados"
    | "/voluntariado"
    | "/generosidade"
    | "/perfil"
    | "/inscricoes"
    | "/batismo"
    | "/grupos"
    | "/devocional";
};

const ATALHOS: Atalho[] = [
  { label: "Devocional", icon: "book", href: "/devocional" },
  { label: "Inscrições", icon: "create", href: "/inscricoes" },
  { label: "Batismo", icon: "water", href: "/batismo" },
  { label: "Grupos", icon: "people", href: "/grupos" },
  { label: "Cuidados", icon: "heart", href: "/cuidados" },
  { label: "Voluntariado", icon: "hand-left", href: "/voluntariado" },
  { label: "Generosidade", icon: "gift", href: "/generosidade" },
];

export default function InicioScreen() {
  const { user } = useAuth();
  const { membro } = useMembro();
  const colors = useColors();
  const { mode } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const router = useRouter();
  const t = useT();
  const { count: naoLidas } = useNotificacoesNaoLidas();
  const [destaques, setDestaques] = useState<Destaque[]>([]);
  const [cultos, setCultos] = useState<CultoUpcoming[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const carregar = useCallback(async (forcar = false) => {
    const [d, c] = await Promise.all([
      destaquesAtivos(forcar).catch(() => []),
      proximosCultos(7, forcar).catch(() => []),
    ]);
    setDestaques(d);
    setCultos(c);
  }, []);

  useEffect(() => {
    setCarregando(true);
    carregar().finally(() => setCarregando(false));
  }, [carregar]);

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
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <ScreenBackground />
      <HeartPulseOverlay visible={refreshing} />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<HeartRefresh refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Logo + ações */}
        <View style={styles.brandRow}>
          <Image
            source={LOGO_WORDMARK}
            style={[styles.logo, { tintColor: mode === "light" ? colors.primary : colors.brandPale }]}
            resizeMode="contain"
          />
          <View style={styles.actions}>
            <AnimatedBell count={naoLidas}>
              <Pressable
                onPress={() => router.navigate("/notificacoes")}
                style={styles.bellWrap}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={t("Notificações")}
              >
                <Ionicons name="notifications-outline" size={22} color={colors.text} />
                {naoLidas > 0 && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeTxt}>
                      {naoLidas > 9 ? "9+" : naoLidas}
                    </Text>
                  </View>
                )}
              </Pressable>
            </AnimatedBell>
            <Pressable
              style={styles.avatar}
              onPress={() => router.navigate("/perfil")}
              accessibilityRole="button"
              accessibilityLabel={t("Abrir perfil")}
            >
              {membro?.avatarUrl ? (
                <Image source={{ uri: membro.avatarUrl }} style={styles.avatarImg} />
              ) : (
                <CbrioHeart size={22} color={colors.brandPale} />
              )}
            </Pressable>
          </View>
        </View>

        <Text style={styles.hello}>{t("Olá")}, {nome}</Text>

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
    content: { padding: spacing.lg, paddingBottom: 120, gap: spacing.lg },
    brandRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginTop: 0,
      marginLeft: -spacing.md,
      paddingRight: spacing.md,
    },
    logo: { width: 150, height: 42 },
    actions: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    bellWrap: {
      width: 40,
      height: 40,
      borderRadius: radius.full,
      backgroundColor: colors.glass,
      borderWidth: 1,
      borderColor: colors.glassBorder,
      alignItems: "center",
      justifyContent: "center",
    },
    badge: {
      position: "absolute",
      top: 2,
      right: 2,
      minWidth: 16,
      height: 16,
      paddingHorizontal: 4,
      borderRadius: 8,
      backgroundColor: colors.danger,
      alignItems: "center",
      justifyContent: "center",
    },
    badgeTxt: { color: "#fff", fontSize: 10, fontWeight: "800" },
    hello: { color: colors.text, fontSize: font.size.xxl, fontFamily: BRAND_FONT, marginTop: spacing.md },
    avatar: {
      width: 40,
      height: 40,
      borderRadius: radius.full,
      backgroundColor: colors.glass,
      borderWidth: 1,
      borderColor: colors.glassBorder,
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden",
    },
    avatarImg: { width: 40, height: 40, borderRadius: radius.full },
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
