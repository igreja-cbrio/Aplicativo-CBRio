import { useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "@/components/ui/Button";
import { CbrioHeart } from "@/components/brand/CbrioHeart";
import { useAuth } from "@/contexts/AuthContext";
import {
  useTheme,
  type ThemePreference,
} from "@/contexts/ThemeContext";
import { font, radius, spacing, type Palette } from "@/constants/theme";

type Option = {
  label: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  onPress?: () => void;
};

const TEMA_OPCOES: { key: ThemePreference; label: string; icon: React.ComponentProps<typeof Ionicons>["name"] }[] = [
  { key: "system", label: "Sistema", icon: "phone-portrait-outline" },
  { key: "light", label: "Claro", icon: "sunny-outline" },
  { key: "dark", label: "Escuro", icon: "moon-outline" },
];

export default function MenuScreen() {
  const { user, signOut } = useAuth();
  const { colors, preference, setPreference } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const router = useRouter();
  const nome = (user?.user_metadata?.nome as string) || "Membro CBRio";

  const options: Option[] = [
    { label: "Meu perfil", icon: "person-outline", onPress: () => router.navigate("/perfil") },
    { label: "Cartões", icon: "card-outline", onPress: () => router.navigate("/cartoes") },
    { label: "Eventos", icon: "calendar-outline" },
    { label: "Bíblia e devocionais", icon: "book-outline" },
    { label: "Notificações", icon: "notifications-outline" },
    { label: "Configurações", icon: "settings-outline" },
    { label: "Sobre a CBRio", icon: "information-circle-outline" },
  ];

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View style={styles.avatar}>
            <CbrioHeart size={32} color={colors.brandPale} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{nome}</Text>
            {!!user?.email && <Text style={styles.meta}>{user.email}</Text>}
          </View>
        </View>

        {/* Aparência (tema claro/escuro) */}
        <Text style={styles.sectionLabel}>Aparência</Text>
        <View style={styles.segment}>
          {TEMA_OPCOES.map((opt) => {
            const active = preference === opt.key;
            return (
              <Pressable
                key={opt.key}
                style={[styles.segmentItem, active && styles.segmentItemActive]}
                onPress={() => setPreference(opt.key)}
              >
                <Ionicons
                  name={opt.icon}
                  size={18}
                  color={active ? "#fff" : colors.textMuted}
                />
                <Text
                  style={[styles.segmentText, active && styles.segmentTextActive]}
                >
                  {opt.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Opções */}
        <View style={styles.list}>
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
              <Text style={styles.rowLabel}>{opt.label}</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </Pressable>
          ))}
        </View>

        <Button title="Sair" variant="ghost" onPress={() => signOut()} />
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
    },
    name: { color: colors.text, fontSize: font.size.lg, fontWeight: "800" },
    meta: { color: colors.textMuted, fontSize: font.size.sm },
    sectionLabel: {
      color: colors.textMuted,
      fontSize: font.size.sm,
      fontWeight: "600",
      marginBottom: -spacing.sm,
    },
    segment: {
      flexDirection: "row",
      gap: spacing.xs,
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.glassBorder,
      padding: spacing.xs,
    },
    segmentItem: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingVertical: spacing.sm,
      borderRadius: radius.sm,
    },
    segmentItemActive: { backgroundColor: colors.primary },
    segmentText: { color: colors.textMuted, fontSize: font.size.sm, fontWeight: "600" },
    segmentTextActive: { color: "#fff" },
    list: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.glassBorder,
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
  });
