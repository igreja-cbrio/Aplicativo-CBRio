import { useEffect, useRef, useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions, type ImageSourcePropType } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useT } from "@/lib/i18n";
import { BRAND_FONT } from "@/lib/fonts";
import { QuickLinks } from "@/components/navigation/QuickLinks";
import { useMenu } from "@/contexts/MenuContext";
import { useTheme } from "@/contexts/ThemeContext";

export type HomeNotice = { id: string; title: string; body?: string; count?: number; href: "/devocional" | "/noticias" };


/** Foto original fornecida pelo marketing, sem textos incorporados. */
export const HOME_BACKGROUND: ImageSourcePropType = require("@/assets/images/home-copacabana.jpg");

export function MarketingHero({ notices, unreadCount = 0, background = HOME_BACKGROUND }: { notices: HomeNotice[]; unreadCount?: number; background?: ImageSourcePropType }) {
  const { height, width, fontScale } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const t = useT();
  const { openMenu } = useMenu();
  const { fontMultiplier } = useTheme();
  const [cardWidth, setCardWidth] = useState(0);
  const [page, setPage] = useState(0);
  const carousel = useRef<ScrollView>(null);
  // Recomeça quando o tamanho ou os avisos mudam; nunca deixa um índice órfão.
  const noticeIds = notices.map((n) => n.id).join(",");
  useEffect(() => {
    setPage(0);
    carousel.current?.scrollTo({ x: 0, animated: false });
  }, [cardWidth, noticeIds]);
  const largeText = fontScale * fontMultiplier > 1.2;
  const titleSize = Math.min(76, (width - 40) * 0.18);
  const selectNotice = (next: number) => {
    const index = (next + notices.length) % notices.length;
    carousel.current?.scrollTo({ x: index * cardWidth, animated: true });
    setPage(index);
  };

  return (
    <View style={[styles.hero, { minHeight: height, paddingTop: insets.top + 12, paddingBottom: Math.max(insets.bottom, 20), paddingLeft: Math.max(insets.left, 20), paddingRight: Math.max(insets.right, 20) }]}>
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        {background ? <Image source={background} resizeMode="cover" style={StyleSheet.absoluteFill} accessibilityIgnoresInvertColors /> : null}
        <LinearGradient colors={background ? ["rgba(12,32,38,0.42)", "rgba(12,32,38,0.46)", "rgba(12,32,38,0.62)"] : ["#49656b", "#314b51", "#142e34"]} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFill} />
      </View>
      <View style={styles.frame}>
        <View style={styles.header}>
          <View style={styles.logoFrame}><Image source={require("@/assets/images/cbrio-wordmark.png")} style={styles.logo} resizeMode="contain" tintColor="#fff" accessible accessibilityLabel="CBRio" /></View>
          <View style={styles.headerActions}>
            <Pressable accessibilityRole="button" accessibilityLabel={t("Notificações")} onPress={() => router.navigate("/notificacoes")} style={styles.headerButton}>
              <Ionicons name="notifications-outline" size={23} color="#fff" />
              {unreadCount > 0 ? <View style={styles.badge}><Text style={styles.badgeText}>{unreadCount > 9 ? "9+" : unreadCount}</Text></View> : null}
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel={t("Menu")} onPress={openMenu} style={styles.headerButton}>
              <Ionicons name="menu-outline" size={32} color="#fff" />
            </Pressable>
          </View>
        </View>
        <View style={[styles.welcome, { paddingVertical: Math.max(64, height * 0.12) }]}>
          <Text style={[styles.eyebrow, { fontSize: titleSize * 0.5, lineHeight: titleSize * 0.55 }]}>{t("seja muito")}</Text>
          <Text accessibilityRole="header" style={[styles.title, { fontSize: titleSize, lineHeight: titleSize * 1.05, marginTop: -8 * fontScale }]}>{t("bem-vindo!")}</Text>
          <Pressable onPress={() => router.navigate("/noticias")} accessibilityRole="button" style={({ pressed }) => [styles.news, pressed && styles.pressed]}>
            <Text style={styles.newsLabel}>{t("veja o que está acontecendo")}</Text>
            <Ionicons name="arrow-forward" size={18} color="#fff" />
          </Pressable>
        </View>
        <View style={styles.footer}>
          {notices.length > 1 ? (
            <Pressable
              accessibilityRole="adjustable"
              accessibilityLabel={t("Avisos")}
              accessibilityValue={{ min: 1, max: notices.length, now: page + 1 }}
              accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
              onAccessibilityAction={(event) => selectNotice(page + (event.nativeEvent.actionName === "decrement" ? -1 : 1))}
              onPress={() => selectNotice(page + 1)}
              style={styles.dots}
            >
              {notices.map((notice, i) => <View key={notice.id} style={[styles.dot, i === page && styles.dotSelected]} />)}
            </Pressable>
          ) : null}
          <View onLayout={(e) => setCardWidth(e.nativeEvent.layout.width)}>
            {cardWidth > 0 ? (
              <ScrollView ref={carousel} horizontal pagingEnabled showsHorizontalScrollIndicator={false} onMomentumScrollEnd={(e) => setPage(Math.max(0, Math.min(notices.length - 1, Math.round(e.nativeEvent.contentOffset.x / cardWidth))))}>
                {notices.map((notice) => (
                  <View key={notice.id} style={{ width: cardWidth, paddingHorizontal: 1 }}>
                    <Pressable onPress={() => router.navigate(notice.href)} accessibilityRole="button" style={({ pressed }) => [styles.notice, largeText && styles.noticeLargeText, pressed && styles.pressed]}>
                      <View style={[styles.noticeLeading, largeText && styles.noticeLeadingLarge]}>
                        {notice.count != null && notice.count > 0 ? <Text style={styles.count} accessibilityLabel={`${notice.count} ${t("dias")}`}>{notice.count}</Text> : <Ionicons name={notice.href === "/devocional" ? "book-outline" : "megaphone-outline"} size={30} color="#fff" />}
                      </View>
                      <View style={[styles.noticeCopy, largeText && styles.noticeCopyLarge]}>
                        <Text style={[styles.noticeTitle, !notice.body && styles.noticeMessage]} numberOfLines={!largeText && notice.body ? 1 : undefined}>{notice.title}</Text>
                        {notice.body ? <Text style={styles.noticeBody} numberOfLines={largeText ? undefined : 1}>{notice.body}</Text> : null}
                      </View>
                    </Pressable>
                  </View>
                ))}
              </ScrollView>
            ) : null}
          </View>
          <QuickLinks />
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
  title: { color: "#fff", fontFamily: BRAND_FONT, textAlign: "center", includeFontPadding: false },
  news: { borderWidth: 1.5, borderColor: "rgba(255,255,255,0.9)", borderRadius: 40, paddingHorizontal: 18, paddingVertical: 13, minHeight: 48, flexDirection: "row", alignItems: "center", gap: 10, marginTop: 18, maxWidth: "100%", backgroundColor: "rgba(12,32,38,0.16)" },
  newsLabel: { color: "#fff", fontSize: 14, flexShrink: 1, textAlign: "center" },
  footer: { paddingTop: 8, paddingBottom: 12 },
  notice: { minHeight: 58, flexDirection: "row", alignItems: "center", paddingVertical: 2, paddingHorizontal: 16, borderRadius: 999, borderWidth: 1.2, borderColor: "rgba(255,255,255,0.95)", backgroundColor: "transparent", marginBottom: 20 },
  noticeLargeText: { paddingVertical: 12, borderRadius: 30, gap: 12 },
  noticeLeading: { width: "40%", alignItems: "flex-start" },
  noticeLeadingLarge: { width: "auto", flexShrink: 0 },
  count: { fontFamily: BRAND_FONT, fontSize: 52, lineHeight: 54, includeFontPadding: false, color: "#fff" },
  noticeCopy: { flex: 1, gap: 3, paddingVertical: 4 },
  noticeCopyLarge: { minWidth: 0 },
  noticeTitle: { color: "#fff", fontWeight: "700", fontSize: 13 },
  noticeMessage: { fontWeight: "500", fontSize: 12, lineHeight: 14 },
  noticeBody: { color: "#eef3f3", fontSize: 12, lineHeight: 18 },
  dots: { flexDirection: "row", alignSelf: "center", alignItems: "flex-end", justifyContent: "center", gap: 3, minWidth: 44, minHeight: 44, paddingBottom: 6 },
  dot: { width: 6, height: 6, borderRadius: 3, borderWidth: 1, borderColor: "#fff" },
  dotSelected: { backgroundColor: "#fff" },
  pressed: { opacity: 0.72 },
});
