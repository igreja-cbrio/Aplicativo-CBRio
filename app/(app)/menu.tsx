import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "@/components/ui/Button";
import { CbrioHeart } from "@/components/brand/CbrioHeart";
import { useAuth } from "@/contexts/AuthContext";
import { colors, font, radius, spacing } from "@/constants/theme";

type Option = {
  label: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  onPress?: () => void;
};

export default function MenuScreen() {
  const { user, signOut } = useAuth();
  const nome = (user?.user_metadata?.nome as string) || "Membro CBRio";

  const options: Option[] = [
    { label: "Meu perfil", icon: "person-outline" },
    { label: "Eventos", icon: "calendar-outline" },
    { label: "Bíblia e devocionais", icon: "book-outline" },
    { label: "Células e grupos", icon: "people-outline" },
    { label: "Notificações", icon: "notifications-outline" },
    { label: "Configurações", icon: "settings-outline" },
    { label: "Sobre a CBRio", icon: "information-circle-outline" },
  ];

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Cabeçalho com o usuário */}
        <View style={styles.header}>
          <View style={styles.avatar}>
            <CbrioHeart size={32} color={colors.brandPale} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{nome}</Text>
            {!!user?.email && <Text style={styles.meta}>{user.email}</Text>}
          </View>
        </View>

        {/* Lista de opções */}
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
              <Ionicons
                name="chevron-forward"
                size={18}
                color={colors.textMuted}
              />
            </Pressable>
          ))}
        </View>

        <Button title="Sair" variant="ghost" onPress={() => signOut()} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
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
