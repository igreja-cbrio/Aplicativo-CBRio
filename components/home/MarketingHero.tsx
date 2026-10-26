import { useEffect, useRef, useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions, type ImageSourcePropType } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useT } from "@/lib/i18n";
import { BRAND_FONT } from "@/lib/fonts";

export type HomeNotice = { id: string; title: string; body?: string; count?: number; href: "/devocional" | "/noticias" };
const SHORTCUTS = [
  { label: "Cuidados", icon: "heart-outline", href: "/cuidados" },
  { label: "Devocional", icon: "book-outline", href: "/devocional" },
  { label: "Grupos", icon: "people-outline", href: "/meu-grupo" },
  { label: "Servir", icon: "hand-left-outline", href: "/voluntariado" },
  { label: "Generosidade", icon: "gift-outline", href: "/generosidade" },
] as const;

/** Foto limpa do marketing ainda pendente. Nunca usar a arte com texto como fundo. */
export const HOME_BACKGROUND: ImageSourcePropType | undefined = undefined;

export function MarketingHero({ notices, unreadCount = 0, background = HOME_BACKGROUND }: { notices: HomeNotice[]; unreadCount?: number; background?: ImageSourcePropType }) {
  const { height, width, fontScale } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const t = useT();
  const [cardWidth, setCardWidth] = useState(0);
  const [page, setPage] = useState(0);
  const carousel = useRef<ScrollView>(null);
  // Recomeça quando o tamanho ou os avisos mudam; nunca deixa um índice órfão.
  const noticeIds = notices.map((n) => n.id).join(",");
  useEffect(() => {
    setPage(0);
    carousel.current?.scrollTo({ x: 0, animated: false });
  }, [cardWidth, noticeIds]);
  const largeText = fontScale > 1.2;
  const scrollShortcuts = largeText || width < 360;

  return (
    <View style={[styles.hero, { minHeight: height, paddingTop: insets.top + 12, paddingBottom: Math.max(insets.bottom, 20), paddingLeft: Math.max(insets.left, 20), paddingRight: Math.max(insets.right, 20) }]}>
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        {background ? <Image source={background} resizeMode="cover" style={StyleSheet.absoluteFill} accessibilityIgnoresInvertColors /> : null}
        <LinearGradient colors={background ? ["rgba(12,32,38,0.28)", "rgba(12,32,38,0.35)", "rgba(12,32,38,0.72)"] : ["#49656b", "#314b51", "#142e34"]} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFill} />
      </View>
      <View style={styles.frame}>
        <View style={styles.header}>
          <View style={styles.logoFrame}><Image source={require("@/assets/images/cbrio-wordmark.png")} style={styles.logo} resizeMode="contain" tintColor="#fff" accessible accessibilityLabel="CBRio" /></View>
          <View style={styles.headerActions}>
            <Pressable accessibilityRole="button" accessibilityLabel={t("Notificações")} onPress={() => router.navigate("/notificacoes")} style={styles.headerButton}>
              <Ionicons name="notifications-outline" size={23} color="#fff" />
              {unreadCount > 0 ? <View style={styles.badge}><Text style={styles.badgeText}>{unreadCount > 9 ? "9+" : unreadCount}</Text></View> : null}
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel={t("Menu")} onPress={() => router.navigate("/menu")} style={styles.headerButton}>
              <Ionicons name="menu-outline" size={32} color="#fff" />
            </Pressable>
          </View>
        </View>
        <View style={[styles.welcome, { paddingVertical: Math.max(64, height * 0.12) }]}>
          <Text style={styles.eyebrow}>{t("seja muito")}</Text>
          <Text accessibilityRole="header" style={[styles.title, { fontSize: Math.min(76, (width - 40) * 0.18) }]}>{t("bem-vindo!")}</Text>
          <Pressable onPress={() => router.navigate("/noticias")} accessibilityRole="button" style={({ pressed }) => [styles.news, pressed && styles.pressed]}>
            <Text style={styles.newsLabel}>{t("veja o que está acontecendo")}</Text>
            <Ionicons name="arrow-forward" size={18} color="#fff" />
          </Pressable>
        </View>
        <View style={styles.footer}>
          <View onLayout={(e) => setCardWidth(e.nativeEvent.layout.width)}>
            {cardWidth > 0 ? (
              <ScrollView ref={carousel} horizontal pagingEnabled showsHorizontalScrollIndicator={false} onMomentumScrollEnd={(e) => setPage(Math.max(0, Math.min(notices.length - 1, Math.round(e.nativeEvent.contentOffset.x / cardWidth))))}>
                {notices.map((notice) => (
                  <View key={notice.id} style={{ width: cardWidth, paddingHorizontal: 1 }}>
                    <Pressable onPress={() => router.navigate(notice.href)} accessibilityRole="button" style={({ pressed }) => [styles.notice, pressed && styles.pressed]}>
                      {notice.count != null && notice.count > 0 ? <Text style={styles.count} accessibilityLabel={`${notice.count} ${t("dias")}`}>{notice.count}</Text> : <Ionicons name={notice.href === "/devocional" ? "book-outline" : "megaphone-outline"} size={30} color="#fff" />}
                      <View style={styles.noticeCopy}>
                        <Text style={styles.noticeTitle}>{notice.title}</Text>
                        {notice.body ? <Text style={styles.noticeBody} numberOfLines={largeText ? undefined : 2}>{notice.body}</Text> : null}
                      </View>
                      <Ionicons name="chevron-forward" size={16} color="#fff" />
                    </Pressable>
                  </View>
                ))}
              </ScrollView>
            ) : null}
          </View>
          {notices.length > 1 ? <View style={styles.dots}>{notices.map((notice, i) => (
            <Pressable key={notice.id} accessibilityRole="button" accessibilityLabel={`${t("Avisos")} ${i + 1}/${notices.length}`} accessibilityState={{ selected: i === page }} onPress={() => { carousel.current?.scrollTo({ x: i * cardWidth, animated: true }); setPage(i); }} style={styles.dotButton}>
              <View style={[styles.dot, i === page && styles.dotSelected]} />
            </Pressable>
          ))}</View> : <View style={{ height: 18 }} />}
          <ScrollView horizontal scrollEnabled={scrollShortcuts} showsHorizontalScrollIndicator={false} style={styles.dock} contentContainerStyle={styles.dockContent}>
            {SHORTCUTS.map((item, i) => (
              <Pressable key={item.href} accessibilityRole="button" accessibilityLabel={t(item.label)} onPress={() => router.navigate(item.href)} style={({ pressed }) => [styles.shortcut, scrollShortcuts ? { width: 120, flexBasis: 120, flexGrow: 0, flexShrink: 0 } : { flex: i === SHORTCUTS.length - 1 ? 1.4 : 1 }, i > 0 && styles.divider, pressed && styles.shortcutPressed]}>
                <Ionicons name={item.icon} size={21} color="#29434a" />
                <Text style={[styles.shortcutLabel, scrollShortcuts && { fontSize: 12 }]}>{t(item.label)}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  hero: { backgroundColor: "#314b51" },
  frame: { flex: 1, width: "100%", maxWidth: 680, alignSelf: "center" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  logoFrame: { width: 112, height: 40, overflow: "hidden" },
  logo: { width: 112, height: 112, position: "absolute", top: -36 },
  headerActions: { flexDirection: "row", gap: 8 },
  badge: { position: "absolute", top: 3, right: 2, backgroundColor: "#fff", borderRadius: 10, minWidth: 18, paddingHorizontal: 3, alignItems: "center" },
  badgeText: { color: "#29434a", fontSize: 10, fontWeight: "700" },
  headerButton: { minWidth: 44, minHeight: 48, alignItems: "center", justifyContent: "center" },
  welcome: { flex: 1, alignItems: "center", justifyContent: "center" },
  eyebrow: { color: "#fff", fontFamily: BRAND_FONT, fontSize: 27, textAlign: "center" },
  title: { color: "#fff", fontFamily: BRAND_FONT, textAlign: "center", marginTop: 0 },
  news: { borderWidth: 1.5, borderColor: "rgba(255,255,255,0.9)", borderRadius: 40, paddingHorizontal: 18, paddingVertical: 13, minHeight: 48, flexDirection: "row", alignItems: "center", gap: 10, marginTop: 18, maxWidth: "100%", backgroundColor: "rgba(12,32,38,0.16)" },
  newsLabel: { color: "#fff", fontSize: 14, flexShrink: 1, textAlign: "center" },
  footer: { paddingTop: 24, paddingBottom: 12 },
  notice: { minHeight: 94, flexDirection: "row", alignItems: "center", gap: 16, paddingVertical: 17, paddingHorizontal: 20, borderRadius: 32, borderWidth: 1.5, borderColor: "rgba(255,255,255,0.75)", backgroundColor: "rgba(12,32,38,0.28)" },
  count: { fontFamily: BRAND_FONT, fontSize: 46, color: "#fff" },
  noticeCopy: { flex: 1, gap: 5 },
  noticeTitle: { color: "#fff", fontWeight: "700", fontSize: 14 },
  noticeBody: { color: "#eef3f3", fontSize: 12, lineHeight: 18 },
  dots: { flexDirection: "row", alignSelf: "center" },
  dotButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  dot: { width: 6, height: 6, borderRadius: 3, borderWidth: 1, borderColor: "#fff" },
  dotSelected: { backgroundColor: "#fff", width: 18 },
  dock: { flexGrow: 0, backgroundColor: "#fafaf6", borderRadius: 28 },
  dockContent: { flexGrow: 1, paddingVertical: 12, paddingHorizontal: 3 },
  shortcut: { minHeight: 48, alignItems: "center", justifyContent: "center", paddingHorizontal: 2, gap: 7 },
  shortcutLabel: { fontSize: 10, fontWeight: "700", color: "#29434a", textAlign: "center", width: "100%" },
  divider: { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: "#c9d1cf" },
  shortcutPressed: { backgroundColor: "#dfe9e7", borderRadius: 16 },
  pressed: { opacity: 0.72 },
});
