import { useMemo } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "@/components/ui/Button";
import { GlassCard } from "@/components/ui/GlassCard";
import { CbrioHeart } from "@/components/brand/CbrioHeart";
import Constants from "expo-constants";
import { useAuth } from "@/contexts/AuthContext";
import { useMembro } from "@/lib/useMembro";
import { useTheme } from "@/contexts/ThemeContext";
import { useT } from "@/lib/i18n";
import { font, radius, spacing, type Palette } from "@/constants/theme";

type Option = {
  label: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  onPress?: () => void;
};

export default function MenuScreen() {
  const { user, signOut } = useAuth();
  const { membro } = useMembro();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const router = useRouter();
  const t = useT();
  const nome =
    membro?.nome || (user?.user_metadata?.nome as string) || t("Membro CBRio");

  const options: Option[] = [
    { label: "Meu perfil", icon: "person-outline", onPress: () => router.navigate("/perfil") },
    { label: "Sua jornada", icon: "trail-sign-outline", onPress: () => router.navigate("/jornada") },
    { label: "Início", icon: "home-outline", onPress: () => router.navigate("/") },
    { label: "Cartões", icon: "card-outline", onPress: () => router.navigate("/cartoes") },
    { label: "Inscrições", icon: "create-outline", onPress: () => router.navigate("/inscricoes") },
    { label: "Batismo", icon: "water-outline", onPress: () => router.navigate("/batismo") },
    { label: "NEXT", icon: "sparkles-outline", onPress: () => router.navigate("/next") },
    { label: "Grupos", icon: "people-outline", onPress: () => router.navigate("/grupos") },
    { label: "Cuidados", icon: "heart-outline", onPress: () => router.navigate("/cuidados") },
    { label: "Voluntariado", icon: "hand-left-outline", onPress: () => router.navigate("/voluntariado") },
    { label: "Generosidade", icon: "gift-outline", onPress: () => router.navigate("/generosidade") },
    { label: "Devocionais", icon: "book-outline", onPress: () => router.navigate("/devocional") },
    { label: "Notificações", icon: "notifications-outline", onPress: () => router.navigate("/notificacoes") },
    { label: "Configurações", icon: "settings-outline", onPress: () => router.navigate("/configuracoes") },
    { label: "Fale conosco", icon: "chatbubble-ellipses-outline", onPress: () => router.navigate("/fale-conosco") },
    { label: "Sobre a CBRio", icon: "information-circle-outline", onPress: () => router.navigate("/sobre") },
  ];

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View style={styles.avatar}>
            {membro?.avatarUrl ? (
              <Image source={{ uri: membro.avatarUrl }} style={styles.avatarImg} />
            ) : (
              <CbrioHeart size={32} color={colors.brandPale} />
            )}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{nome}</Text>
            {!!user?.email && <Text style={styles.meta}>{user.email}</Text>}
          </View>
        </View>

        {/* Opções */}
        <GlassCard style={styles.list}>
          {options.map((opt, i) => (
            <Pressable
              key={opt.label}
              onPress={opt.onPress}
              style={({ pressed }) => [
                styles.row,
                i > 0 && styles.rowBorder,
                pressed && styles.rowPressed,
              ]}
            >
              <Ionicons name={opt.icon} size={22} color={colors.brandMid} />
              <Text style={styles.rowLabel}>{t(opt.label)}</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </Pressable>
          ))}
        </GlassCard>

        <Button title={t("Sair")} variant="ghost" onPress={() => signOut()} />

        <View style={styles.versao}>
          <Text style={styles.versaoTxt}>
            CBRio · {t("versão")} {Constants.expoConfig?.version ?? "1.0.0"}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    content: { padding: spacing.lg, paddingBottom: 120, gap: spacing.lg },
    header: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      marginTop: spacing.md,
    },
    avatar: {
      width: 64,
      height: 64,
      borderRadius: radius.full,
      backgroundColor: colors.glass,
      borderWidth: 1,
      borderColor: colors.glassBorder,
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden",
    },
    avatarImg: { width: 64, height: 64, borderRadius: radius.full },
    name: { color: colors.text, fontSize: font.size.lg, fontWeight: "800" },
    meta: { color: colors.textMuted, fontSize: font.size.sm },
    list: {
      borderRadius: radius.lg,
      overflow: "hidden",
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
    },
    rowBorder: { borderTopWidth: 1, borderTopColor: colors.border },
    rowPressed: { backgroundColor: colors.surfaceAlt },
    rowLabel: { flex: 1, color: colors.text, fontSize: font.size.md },
    versao: {
      alignItems: "center",
      paddingVertical: spacing.lg,
    },
    versaoTxt: { color: colors.textMuted, fontSize: 12 },
  });
