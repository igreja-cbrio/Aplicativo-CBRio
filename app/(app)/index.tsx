import { useMemo } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { CbrioHeart } from "@/components/brand/CbrioHeart";
import { useAuth } from "@/contexts/AuthContext";
import { useColors, useTheme } from "@/contexts/ThemeContext";
import { useMembro } from "@/lib/useMembro";
import { useNotificacoesNaoLidas } from "@/lib/useNotificacoes";
import { font, radius, spacing, type Palette } from "@/constants/theme";

const LOGO_LIGHT = require("../../assets/images/cbrio-wordmark.png");
const LOGO_DARK = require("../../assets/images/cbrio-vertical-light.png");

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
    | "/inscricoes";
  desc: string;
};

const ATALHOS: Atalho[] = [
  { label: "Inscrições", icon: "create", href: "/inscricoes", desc: "Batismo, grupos, NEXT…" },
  { label: "Cuidados", icon: "heart", href: "/cuidados", desc: "Oração e apoio" },
  { label: "Voluntariado", icon: "hand-left", href: "/voluntariado", desc: "Sirva com a gente" },
  { label: "Generosidade", icon: "gift", href: "/generosidade", desc: "Dízimos e ofertas" },
  { label: "Meu perfil", icon: "person", href: "/perfil", desc: "Conta e cartões" },
];

export default function InicioScreen() {
  const { user } = useAuth();
  const { membro } = useMembro();
  const colors = useColors();
  const { mode } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const router = useRouter();
  const { count: naoLidas } = useNotificacoesNaoLidas();
  const nome = primeiroNome(
    membro?.nome || (user?.user_metadata?.nome as string | undefined),
    user?.email
  );

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Logo + ações */}
        <View style={styles.brandRow}>
          <Image
            source={mode === "light" ? LOGO_LIGHT : LOGO_DARK}
            style={styles.logo}
            resizeMode="contain"
          />
          <View style={styles.actions}>
            <Pressable
              onPress={() => router.navigate("/notificacoes")}
              style={styles.bellWrap}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Notificações"
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
            <Pressable
              style={styles.avatar}
              onPress={() => router.navigate("/perfil")}
              accessibilityRole="button"
              accessibilityLabel="Abrir perfil"
            >
              {membro?.avatarUrl ? (
                <Image source={{ uri: membro.avatarUrl }} style={styles.avatarImg} />
              ) : (
                <CbrioHeart size={22} color={colors.brandPale} />
              )}
            </Pressable>
          </View>
        </View>

        <Text style={styles.hello}>Olá, {nome}</Text>

        {/* Atalhos para os módulos */}
        <Text style={styles.sectionTitle}>Atalhos</Text>
        <View style={styles.grid}>
          {ATALHOS.map((a) => (
            <Pressable
              key={a.href}
              style={({ pressed }) => [styles.shortcut, pressed && styles.pressed]}
              onPress={() => router.navigate(a.href)}
            >
              <View style={styles.shortcutIcon}>
                <Ionicons name={a.icon} size={22} color={colors.brandMid} />
              </View>
              <Text style={styles.shortcutLabel}>{a.label}</Text>
              <Text style={styles.shortcutDesc}>{a.desc}</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    content: { padding: spacing.lg, paddingBottom: 120, gap: spacing.lg },
    brandRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginTop: spacing.sm,
    },
    logo: { width: 110, height: 32 },
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
    hello: { color: colors.text, fontSize: font.size.xxl, fontWeight: "800", marginTop: spacing.md },
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
      fontWeight: "700",
    },
    grid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.md,
    },
    shortcut: {
      width: "47%",
      flexGrow: 1,
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.glassBorder,
      padding: spacing.lg,
      gap: spacing.xs,
    },
    pressed: { opacity: 0.7 },
    shortcutIcon: {
      width: 44,
      height: 44,
      borderRadius: radius.md,
      backgroundColor: colors.glass,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: spacing.xs,
    },
    shortcutLabel: {
      color: colors.text,
      fontSize: font.size.md,
      fontWeight: "700",
    },
    shortcutDesc: { color: colors.textMuted, fontSize: font.size.sm },
  });
