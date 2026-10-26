import { Text } from "@/components/ui/Typography";
import { Ionicons } from "@expo/vector-icons";
import { usePathname, type Href } from "expo-router";
import { Image, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useAuth } from "@/contexts/AuthContext";
import { useMembro } from "@/lib/useMembro";
import { useT } from "@/lib/i18n";
import { MENU_SECTIONS } from "@/lib/appNavigation";
import { BRAND_FONT } from "@/lib/fonts";

export function MenuContent({ onNavigate, onSignOut }: { onNavigate: (href: Href) => void; onSignOut: () => void }) {
  const { user } = useAuth(), { membro } = useMembro(), t = useT(), pathname = usePathname();
  return <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
    <Pressable accessibilityRole="button" accessibilityLabel={t("Meu perfil")} onPress={() => onNavigate("/perfil")} style={styles.profile}>
      {membro?.avatarUrl ? <Image source={{ uri: membro.avatarUrl }} style={styles.avatar} /> : <View style={styles.avatar}><Ionicons name="person-outline" color="#fff" size={24} /></View>}
      <Text style={styles.name}>{membro?.nome || user?.user_metadata?.nome || t("Membro CBRio")}</Text>
    </Pressable>
    {MENU_SECTIONS.map((section) => <View key={section.title} style={styles.section}>
      <Text accessibilityRole="header" style={styles.sectionTitle}>{t(section.title)}</Text>
      {section.items.map((item) => <Pressable key={item.href} accessibilityRole="button" accessibilityState={{ selected: pathname === item.href }} onPress={() => onNavigate(item.href)} style={({ pressed }) => [styles.row, (pressed || pathname === item.href) && styles.selected]}>
        <Ionicons name={item.icon} size={21} color="#fff" /><Text style={styles.label}>{t(item.label)}</Text><Ionicons name="chevron-forward" size={15} color="#cfdbdc" />
      </Pressable>)}
    </View>)}
    <Pressable accessibilityRole="button" onPress={onSignOut} style={styles.row}><Ionicons name="log-out-outline" size={21} color="#fff" /><Text style={styles.label}>{t("Sair")}</Text></Pressable>
  </ScrollView>;
}
const styles = StyleSheet.create({
  content: { paddingHorizontal: 22, paddingBottom: 30, gap: 24 },
  profile: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#72898d" },
  avatar: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: "#9aacaf", alignItems: "center", justifyContent: "center" },
  name: { fontFamily: BRAND_FONT, color: "#fff", fontSize: 21, flex: 1 },
  section: { gap: 3 },
  sectionTitle: { color: "#ccd9db", fontSize: 12, fontWeight: "600", letterSpacing: 1, marginBottom: 6 },
  row: { minHeight: 48, flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, paddingHorizontal: 12, borderRadius: 22 },
  label: { flex: 1, color: "#fff", fontSize: 14 },
  selected: { backgroundColor: "rgba(255,255,255,0.13)" },
});
