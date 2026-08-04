// ============================================================================
// FAIXA SUPERIOR · o eixo da navegação (Marcos · 04/08/2026)
//
// Esquerda: SETA. Ela é a única porta pra Home — por decisão do Marcos NÃO
// existe botão "Início" em lugar nenhum. Comportamento: volta um passo; quando
// não há passo anterior (tela de barra, ou app aberto direto ali por push),
// vai pra Home. É o mesmo padrão `canGoBack() ? back() : replace("/")` que 10
// telas já usavam soltas — aqui virou regra única.
//
// Direita: SINO com contador de não lidas + FOTO do membro. Ficam no mesmo
// lugar em toda tela, pra notificação e perfil estarem sempre a um toque
// (ponto 4 do Marcos).
//
// Centro: nome da tela; na Home, o logo. Sem a barra de abas, o título é o que
// diz "onde estou" — a seta sozinha desorienta.
// ============================================================================
import { useMemo } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/contexts/ThemeContext";
import { useMembro } from "@/lib/useMembro";
import { useNotificacoesNaoLidas } from "@/lib/useNotificacoes";
import { useT } from "@/lib/i18n";
import { AnimatedBell } from "@/components/anim/AnimatedBell";
import { CbrioHeart } from "@/components/brand/CbrioHeart";
import { font, radius, spacing, type Palette } from "@/constants/theme";

const LOGO_WORDMARK = require("@/assets/images/cbrio-wordmark.png");

export const TOPBAR_H = 54;

export function TopBar({
  titulo,
  mostrarLogo = false,
  mostrarVoltar = true,
}: {
  /** Nome da tela no centro. Ignorado quando `mostrarLogo`. */
  titulo?: string;
  /** Home: logo no centro em vez do título. */
  mostrarLogo?: boolean;
  /** Home é a raiz — lá a seta não faz sentido. */
  mostrarVoltar?: boolean;
}) {
  const { colors, mode } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const t = useT();
  const { membro } = useMembro();
  const { count: naoLidas } = useNotificacoesNaoLidas();

  // A seta é "um passo atrás"; sem histórico, é a porta da Home.
  const voltar = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/");
  };

  return (
    <View style={[styles.faixa, { paddingTop: insets.top, height: insets.top + TOPBAR_H }]}>
      <View style={styles.esq}>
        {mostrarVoltar && (
          <Pressable
            onPress={voltar}
            hitSlop={10}
            style={styles.btn}
            accessibilityRole="button"
            accessibilityLabel={t("Voltar")}
          >
            <Ionicons name="chevron-back" size={22} color={colors.primary} />
          </Pressable>
        )}
      </View>

      <View style={styles.centro}>
        {mostrarLogo ? (
          <Image
            source={LOGO_WORDMARK}
            style={styles.logo}
            resizeMode="contain"
            tintColor={mode === "dark" ? colors.brandPale : colors.primary}
          />
        ) : (
          <Text style={styles.titulo} numberOfLines={1}>{titulo || ""}</Text>
        )}
      </View>

      <View style={styles.dir}>
        <AnimatedBell count={naoLidas}>
          <Pressable
            onPress={() => router.push("/notificacoes")}
            hitSlop={8}
            style={styles.btn}
            accessibilityRole="button"
            accessibilityLabel={t("Notificações")}
          >
            <Ionicons name="notifications-outline" size={21} color={colors.primary} />
            {naoLidas > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeTxt}>{naoLidas > 9 ? "9+" : naoLidas}</Text>
              </View>
            )}
          </Pressable>
        </AnimatedBell>

        <Pressable
          onPress={() => router.push("/perfil")}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={t("Meu perfil")}
        >
          <View style={styles.avatar}>
            {membro?.avatarUrl ? (
              <Image source={{ uri: membro.avatarUrl }} style={styles.avatarImg} />
            ) : (
              <CbrioHeart size={20} color={colors.brandPale} />
            )}
          </View>
        </Pressable>
      </View>
    </View>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    faixa: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: spacing.sm,
      gap: spacing.sm,
      backgroundColor: colors.surface,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    // Laterais com largura fixa: sem isso o título do centro "pula" de posição
    // conforme o tamanho do nome da tela.
    esq: { width: 76, flexDirection: "row", alignItems: "center" },
    centro: { flex: 1, alignItems: "center", justifyContent: "center" },
    dir: { width: 76, flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: spacing.xs },
    btn: {
      width: 34, height: 34, borderRadius: radius.full,
      alignItems: "center", justifyContent: "center",
      backgroundColor: colors.surfaceAlt,
    },
    logo: { width: 118, height: 30 },
    titulo: { color: colors.text, fontSize: font.size.md, fontWeight: "700" },
    badge: {
      position: "absolute", top: -2, right: -2,
      minWidth: 16, height: 16, paddingHorizontal: 4,
      borderRadius: radius.full,
      backgroundColor: colors.danger,
      alignItems: "center", justifyContent: "center",
      borderWidth: 2, borderColor: colors.surface,
    },
    badgeTxt: { color: "#fff", fontSize: 10, fontWeight: "800" },
    avatar: {
      width: 34, height: 34, borderRadius: radius.full,
      backgroundColor: colors.glass,
      borderWidth: 1, borderColor: colors.glassBorder,
      alignItems: "center", justifyContent: "center",
      overflow: "hidden",
    },
    avatarImg: { width: 34, height: 34, borderRadius: radius.full },
  });
