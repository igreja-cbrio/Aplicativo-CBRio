import { useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { CbrioHeart } from "@/components/brand/CbrioHeart";
import { useAuth } from "@/contexts/AuthContext";
import { useColors } from "@/contexts/ThemeContext";
import { font, radius, spacing, type Palette } from "@/constants/theme";

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
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const router = useRouter();
  const nome = primeiroNome(
    user?.user_metadata?.nome as string | undefined,
    user?.email
  );

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Topo: saudação + avatar (abre o perfil) */}
        <View style={styles.topRow}>
          <View style={styles.greeting}>
            <Text style={styles.hello}>Olá, {nome} 👋</Text>
            <Text style={styles.subtitle}>Que bom ter você na CBRio.</Text>
          </View>
          <Pressable
            style={styles.avatar}
            onPress={() => router.navigate("/perfil")}
            accessibilityRole="button"
            accessibilityLabel="Abrir perfil"
          >
            <CbrioHeart size={28} color={colors.brandPale} />
          </Pressable>
        </View>

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
    topRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginTop: spacing.md,
    },
    greeting: { flex: 1, gap: 2 },
    hello: { color: colors.text, fontSize: font.size.xxl, fontWeight: "800" },
    subtitle: { color: colors.textMuted, fontSize: font.size.md },
    avatar: {
      width: 52,
      height: 52,
      borderRadius: radius.full,
      backgroundColor: colors.glass,
      borderWidth: 1,
      borderColor: colors.glassBorder,
      alignItems: "center",
      justifyContent: "center",
    },
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
