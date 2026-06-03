import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/contexts/AuthContext";
import { colors, font, spacing } from "@/constants/theme";

export default function HomeScreen() {
  const { user, signOut } = useAuth();
  const nome = (user?.user_metadata?.nome as string) || user?.email || "membro";

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.hello}>Olá, {nome} 👋</Text>
          <Text style={styles.note}>
            Autenticação concluída. Os próximos módulos do app entram aqui.
          </Text>
        </View>

        <Button title="Sair" variant="ghost" onPress={() => signOut()} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { flex: 1, padding: spacing.lg, justifyContent: "space-between" },
  header: { gap: spacing.sm, marginTop: spacing.xl },
  hello: { color: colors.text, fontSize: font.size.xxl, fontWeight: "800" },
  note: { color: colors.textMuted, fontSize: font.size.md, lineHeight: 22 },
});
