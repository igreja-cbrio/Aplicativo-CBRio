import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CbrioHeart } from "@/components/brand/CbrioHeart";
import { useAuth } from "@/contexts/AuthContext";
import { colors, font, radius, spacing } from "@/constants/theme";

function primeiroNome(nomeCompleto?: string, email?: string | null) {
  const nome = nomeCompleto?.trim();
  if (nome) return nome.split(/\s+/)[0];
  // Sem nome: deriva do e-mail (matheus@... -> Matheus)
  const local = (email ?? "").split("@")[0]?.split(/[._-]/)[0] ?? "";
  if (local) return local.charAt(0).toUpperCase() + local.slice(1);
  return "membro";
}

export default function InicioScreen() {
  const { user } = useAuth();
  const nome = primeiroNome(
    user?.user_metadata?.nome as string | undefined,
    user?.email
  );

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <CbrioHeart size={48} color={colors.brandMid} />
          <Text style={styles.hello}>Olá, {nome} 👋</Text>
          <Text style={styles.subtitle}>Que bom ter você na CBRio.</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Bem-vindo ao app</Text>
          <Text style={styles.cardText}>
            Use o menu abaixo para navegar. Os próximos módulos (eventos, Bíblia
            e seu perfil) vão aparecer aqui conforme forem construídos.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: {
    padding: spacing.lg,
    paddingBottom: 120, // espaço para o dock flutuante
    gap: spacing.lg,
  },
  header: { gap: spacing.sm, marginTop: spacing.md },
  hello: { color: colors.text, fontSize: font.size.xxl, fontWeight: "800" },
  subtitle: { color: colors.textMuted, fontSize: font.size.md },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  cardTitle: { color: colors.text, fontSize: font.size.lg, fontWeight: "700" },
  cardText: { color: colors.textMuted, fontSize: font.size.md, lineHeight: 22 },
});
