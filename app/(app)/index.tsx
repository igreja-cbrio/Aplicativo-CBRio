import { useEffect, useMemo, useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { CbrioHeart } from "@/components/brand/CbrioHeart";
import { useAuth } from "@/contexts/AuthContext";
import { useColors, useTheme } from "@/contexts/ThemeContext";
import { useMembro } from "@/lib/useMembro";
import { useNotificacoesNaoLidas } from "@/lib/useNotificacoes";
import { destaquesAtivos, type Destaque } from "@/lib/destaques";
import { proximosCultos, type CultoUpcoming } from "@/lib/cultos";
import { Carrossel } from "@/components/home/Carrossel";
import { ProximosCultos } from "@/components/home/ProximosCultos";
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
    | "/inscricoes";
};

const ATALHOS: Atalho[] = [
  { label: "Inscrições", icon: "create", href: "/inscricoes" },
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
  const { count: naoLidas } = useNotificacoesNaoLidas();
  const [destaques, setDestaques] = useState<Destaque[]>([]);
  const [cultos, setCultos] = useState<CultoUpcoming[]>([]);

  useEffect(() => {
    destaquesAtivos().then(setDestaques).catch(() => setDestaques([]));
    proximosCultos(7).then(setCultos).catch(() => setCultos([]));
  }, []);
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
            source={LOGO_WORDMARK}
            style={[styles.logo, { tintColor: mode === "light" ? colors.primary : colors.brandPale }]}
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

        {destaques.length > 0 && <Carrossel itens={destaques} />}

        <ProximosCultos cultos={cultos} />

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
              <Text style={styles.shortcutLabel} numberOfLines={1}>{a.label}</Text>
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
    logo: { width: 150, height: 42, marginLeft: -spacing.md },
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
      justifyContent: "space-between",
      gap: spacing.sm,
    },
    shortcut: {
      width: "22%",
      alignItems: "center",
      gap: 6,
    },
    pressed: { opacity: 0.7 },
    shortcutIcon: {
      width: 56,
      height: 56,
      borderRadius: radius.md,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.glassBorder,
      alignItems: "center",
      justifyContent: "center",
    },
    shortcutLabel: {
      color: colors.text,
      fontSize: 12,
      fontWeight: "600",
      textAlign: "center",
    },
  });
