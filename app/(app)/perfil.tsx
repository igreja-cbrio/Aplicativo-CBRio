import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "@/components/ui/Button";
import { CbrioHeart } from "@/components/brand/CbrioHeart";
import { useAuth } from "@/contexts/AuthContext";
import { colors, font, radius, spacing } from "@/constants/theme";

export default function PerfilScreen() {
  const { user, signOut } = useAuth();
  const nome = (user?.user_metadata?.nome as string) || "Membro CBRio";

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View style={styles.avatar}>
            <CbrioHeart size={40} color={colors.brandPale} />
          </View>
          <Text style={styles.name}>{nome}</Text>
          {!!user?.email && <Text style={styles.meta}>{user.email}</Text>}
          {!!user?.phone && <Text style={styles.meta}>+{user.phone}</Text>}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardText}>
            Mais opções de perfil (editar dados, foto e preferências) chegam em
            breve.
          </Text>
        </View>

        <Button title="Sair" variant="ghost" onPress={() => signOut()} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: {
    padding: spacing.lg,
    paddingBottom: 120,
    gap: spacing.lg,
  },
  header: { alignItems: "center", gap: spacing.xs, marginTop: spacing.md },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: radius.full,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.sm,
  },
  name: { color: colors.text, fontSize: font.size.xl, fontWeight: "800" },
  meta: { color: colors.textMuted, fontSize: font.size.md },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    padding: spacing.lg,
  },
  cardText: { color: colors.textMuted, fontSize: font.size.md, lineHeight: 22 },
});
