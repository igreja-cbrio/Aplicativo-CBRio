import { Text } from "@/components/ui/Typography";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, RefreshControl, Image, Pressable, ScrollView, StyleSheet, View, useWindowDimensions, type ImageSourcePropType } from "react-native";
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

// Recorte da última referência ("Ver as fotos recentes.png"), sem as faixas
// pretas: x=972..2312 na foto original de 3600 × 2387. Escala só pela largura:
// celulares altos ganham céu acima, nunca outro zoom/corte nem distorção.
const PHOTO_CROP = { x: 972, width: 1340 };

export function MarketingHero({ notices, unreadCount = 0, background = HOME_BACKGROUND, refreshing = false, onRefresh }: { notices: HomeNotice[]; unreadCount?: number; background?: ImageSourcePropType; refreshing?: boolean; onRefresh?: () => void }) {
  const { height, width, fontScale } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [viewportHeight, setViewportHeight] = useState(height);
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
    <View style={styles.hero} onLayout={(event) => setViewportHeight(event.nativeEvent.layout.height)}>
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        {background ? <View style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: width * 2387 / PHOTO_CROP.width }}>
          <Image source={background} resizeMode="contain" style={{
            position: "absolute", top: 0,
            width: width * 3600 / PHOTO_CROP.width,
            // Image nativa herda a altura do asset (2387), mesmo com top/bottom.
            // Sobrescrever as duas dimensões mantém a foto dentro do recorte.
            height: width * 2387 / PHOTO_CROP.width,
            left: -width * PHOTO_CROP.x / PHOTO_CROP.width,
          }} accessibilityIgnoresInvertColors />
          <LinearGradient colors={["#598592", "rgba(89,133,146,0)"]} style={{ position: "absolute", top: 0, left: 0, right: 0, height: "12%" }} />
        </View> : null}
        <LinearGradient colors={background ? ["rgba(12,32,38,0.42)", "rgba(12,32,38,0.46)", "rgba(12,32,38,0.62)"] : ["#49656b", "#314b51", "#142e34"]} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFill} />
      </View>
      <ScrollView style={styles.scroll} contentContainerStyle={{ minHeight: viewportHeight, paddingTop: insets.top + 12, paddingBottom: Math.max(insets.bottom, 20), paddingLeft: Math.max(insets.left, 20), paddingRight: Math.max(insets.right, 20) }} showsVerticalScrollIndicator={false} contentInsetAdjustmentBehavior="never" alwaysBounceVertical={!!onRefresh} bounces={!!onRefresh} overScrollMode="never" refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" colors={["#314b51"]} progressViewOffset={insets.top} /> : undefined}>
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
        <View style={styles.welcome}>
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
      </ScrollView>
      {refreshing && <View pointerEvents="none" accessibilityRole="progressbar" accessibilityLabel={t("Atualizando...")} style={[styles.refresh, { top: insets.top + 64 }]}>
        <ActivityIndicator color="#fff" size="small" />
        <Text style={styles.refreshText}>{t("Atualizando...")}</Text>
      </View>}
    </View>
  );
}
const styles = StyleSheet.create({
  hero: { flex: 1, backgroundColor: "#598592", overflow: "hidden" },
  scroll: { flex: 1 },
  refresh: { position: "absolute", alignSelf: "center", borderRadius: 24, paddingHorizontal: 18, paddingVertical: 10, backgroundColor: "rgba(25,52,59,0.9)", flexDirection: "row", alignItems: "center", gap: 10 },
  refreshText: { color: "#fff", fontSize: 13, fontWeight: "700" },
  frame: { flex: 1, width: "100%", maxWidth: 680, alignSelf: "center" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  logoFrame: { width: 112, height: 40, overflow: "hidden" },
  logo: { width: 112, height: 112, position: "absolute", top: -36 },
  headerActions: { flexDirection: "row", gap: 8 },
  badge: { position: "absolute", top: 1, right: 0, backgroundColor: "#fff", borderRadius: 999, minWidth: 20, minHeight: 20, paddingHorizontal: 5, paddingVertical: 2, alignItems: "center", justifyContent: "center" },
  badgeText: { color: "#29434a", fontSize: 11, lineHeight: 16, fontWeight: "700", textAlign: "center" },
  headerButton: { minWidth: 44, minHeight: 48, alignItems: "center", justifyContent: "center" },
  welcome: { flex: 1, paddingVertical: 24, alignItems: "center", justifyContent: "center" },
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
