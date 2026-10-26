import { Image, Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { usePathname, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useT } from "@/lib/i18n";
import { subirUmNivel } from "@/lib/hierarquia";
import { useMenu } from "@/contexts/MenuContext";
import { useNotificacoesNaoLidas } from "@/lib/useNotificacoes";
import { useColors } from "@/contexts/ThemeContext";
import { AnimatedBell } from "@/components/anim/AnimatedBell";

export const TOPBAR_H = 64;
/** Cabeçalho da identidade do marketing; títulos específicos permanecem no conteúdo. */
export function TopBar({ mostrarVoltar = false }: { mostrarVoltar?: boolean }) {
  const colors = useColors();
  const insets = useSafeAreaInsets(), pathname = usePathname(), router = useRouter(), t = useT();
  const { openMenu } = useMenu(), { count } = useNotificacoesNaoLidas();
  return <View style={[styles.header, { paddingTop: insets.top, minHeight: insets.top + TOPBAR_H }]}>
    {mostrarVoltar ? <Pressable accessibilityRole="button" accessibilityLabel={t("Voltar")} onPress={() => subirUmNivel(pathname)} style={styles.button}><Ionicons name="chevron-back" size={24} color={colors.text} /></Pressable> : null}
    <Pressable accessibilityRole="button" accessibilityLabel={t("Início")} onPress={() => router.navigate("/")} style={styles.brand}>
      <View style={styles.logoFrame}><Image source={require("@/assets/images/cbrio-wordmark.png")} resizeMode="contain" tintColor={colors.text} style={styles.logo} /></View>
    </Pressable>
    <AnimatedBell count={count}><Pressable accessibilityRole="button" accessibilityLabel={t("Notificações")} onPress={() => router.navigate("/notificacoes")} style={styles.button}><Ionicons name="notifications-outline" size={23} color={colors.text} />{count > 0 ? <View style={[styles.dot, { backgroundColor: colors.text }]} /> : null}</Pressable></AnimatedBell>
    <Pressable accessibilityRole="button" accessibilityLabel={t("Menu")} onPress={openMenu} style={styles.button}><Ionicons name="menu-outline" size={30} color={colors.text} /></Pressable>
  </View>;
}
const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, gap: 6, backgroundColor: "transparent" },
  button: { minWidth: 44, minHeight: 48, alignItems: "center", justifyContent: "center" },
  brand: { flex: 1, minHeight: 48, justifyContent: "center" },
  logoFrame: { width: 96, height: 34, overflow: "hidden" },
  logo: { width: 96, height: 96, position: "absolute", top: -31 },
  dot: { position: "absolute", top: 9, right: 9, width: 7, height: 7, backgroundColor: "#fff", borderRadius: 4 },
});
