import React, { useEffect, useRef, useState, type ComponentType, type ReactNode } from "react";
import { AccessibilityInfo, Animated, AppState, Easing, Image, ScrollView, StyleSheet, Text as NativeText, View, type TextProps } from "react-native";
import Svg, { Defs, Ellipse, LinearGradient, Stop } from "react-native-svg";

export type CoresHalo = { background: string; text: string; textMuted: string; primary: string; surfaceAlt: string; border: string };
export type PropsHalo = {
  colors: CoresHalo;
  t: (texto: string) => string;
  titulo: string;
  detalhe: string;
  status: string;
  selfie?: string | null;
  camera?: ReactNode;
  lendo?: boolean;
  progresso?: { feitas: number; total: number };
  children?: ReactNode;
  bottomInset?: number;
  TextComponent?: ComponentType<TextProps>;
};

/** Só apresentação: não detecta rostos, não captura e não inventa progresso. */
export function HaloBuscaFacial({ colors, t, titulo, detalhe, status, selfie, camera, lendo = true, progresso, children, bottomInset = 0, TextComponent = NativeText }: PropsHalo) {
  const pulse = useRef(new Animated.Value(0)).current;
  const [reduzir, setReduzir] = useState(true);
  const [ativa, setAtiva] = useState(AppState.currentState === "active");
  useEffect(() => {
    let viva = true;
    let mudou = false;
    AccessibilityInfo.isReduceMotionEnabled().then(v => { if (viva && !mudou) setReduzir(v); }).catch(() => {});
    const acessibilidade = AccessibilityInfo.addEventListener("reduceMotionChanged", v => { mudou = true; setReduzir(v); });
    const estado = AppState.addEventListener("change", s => setAtiva(s === "active"));
    return () => { viva = false; acessibilidade.remove(); estado.remove(); };
  }, []);
  useEffect(() => {
    pulse.setValue(0);
    if (reduzir || !ativa || !lendo) return;
    const animacao = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 1500, easing: Easing.inOut(Easing.sin), useNativeDriver: true, isInteraction: false }),
      Animated.timing(pulse, { toValue: 0, duration: 1500, easing: Easing.inOut(Easing.sin), useNativeDriver: true, isInteraction: false }),
    ]));
    animacao.start();
    return () => { animacao.stop(); pulse.stopAnimation(); };
  }, [ativa, lendo, pulse, reduzir]);
  const total = Math.max(0, progresso?.total ?? 0);
  const feitas = Math.max(0, Math.min(total, progresso?.feitas ?? 0));
  const percentual = total > 0 ? Math.round(feitas / total * 100) : 0;
  const Texto = TextComponent;
  return (
    <ScrollView contentContainerStyle={[s.content, { paddingBottom: bottomInset + 24 }]}>
      <Texto style={[s.eyebrow, { color: colors.textMuted }]}>{t("FOTOS DO BATISMO")}</Texto>
      <Texto accessibilityRole="header" accessibilityLiveRegion="polite" style={[s.title, { color: colors.text }]}>{titulo}</Texto>
      <Texto style={[s.detail, { color: colors.textMuted }]}>{detalhe}</Texto>
      <View style={s.lens} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <View style={[s.portrait, { backgroundColor: colors.surfaceAlt }]}>
          {camera ?? (selfie ? <Image source={{ uri: selfie }} resizeMode="cover" style={StyleSheet.absoluteFill} accessible={false} /> : <View style={s.silhouette}><View style={[s.head, { backgroundColor: colors.border }]} /><View style={[s.shoulders, { backgroundColor: colors.border }]} /></View>)}
        </View>
        <Animated.View pointerEvents="none" style={[s.ring, { opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] }) }]}>
          <Svg width="100%" height="100%" viewBox="0 0 260 316">
            <Defs><LinearGradient id="halo-luz" x1="0%" y1="0%" x2="100%" y2="100%"><Stop offset="0" stopColor="#67d8c7" /><Stop offset="0.45" stopColor={colors.primary} /><Stop offset="1" stopColor="#67d8c7" /></LinearGradient></Defs>
            <Ellipse cx="130" cy="158" rx="119" ry="147" fill="none" stroke="url(#halo-luz)" strokeWidth="2.5" />
          </Svg>
        </Animated.View>
        <Animated.View pointerEvents="none" style={[s.ring, { opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.12, 0.32] }), transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.045] }) }] }]}>
          <Svg width="100%" height="100%" viewBox="0 0 260 316"><Ellipse cx="130" cy="158" rx="127" ry="155" fill="none" stroke="#67d8c7" strokeWidth="1" /></Svg>
        </Animated.View>
      </View>
      <View style={s.status}><View style={[s.statusDot, { backgroundColor: colors.primary }]} /><Texto style={[s.statusText, { color: colors.textMuted }]}>{status}</Texto></View>
      {progresso && total > 0 ? <View style={s.progressArea}>
        <Texto style={[s.count, { color: colors.text }]}>{feitas} {t("de")} {total} {t("fotos processadas")}</Texto>
        <View accessibilityRole="progressbar" accessibilityLabel={t("Busca no álbum")} accessibilityValue={{ min: 0, max: total, now: feitas }} style={[s.track, { backgroundColor: colors.surfaceAlt }]}><View style={[s.fill, { backgroundColor: colors.primary, width: `${percentual}%` }]} /></View>
      </View> : null}
      <View style={s.actions}>{children}</View>
      <Texto style={[s.privacy, { color: colors.textMuted }]}>{t("Seu rosto fica apenas neste aparelho.")}</Texto>
    </ScrollView>
  );
}
const s = StyleSheet.create({
  content: { flexGrow: 1, alignItems: "center", paddingHorizontal: 24, paddingTop: 22 },
  eyebrow: { fontSize: 11, letterSpacing: 2, fontWeight: "700", textAlign: "center", marginBottom: 12 },
  title: { fontSize: 28, lineHeight: 34, fontWeight: "700", textAlign: "center", maxWidth: 320 },
  detail: { fontSize: 14, lineHeight: 21, textAlign: "center", maxWidth: 300, marginTop: 12 },
  lens: { width: 260, maxWidth: "100%", aspectRatio: 260 / 316, alignItems: "center", justifyContent: "center", marginTop: 20, marginBottom: 18 },
  portrait: { width: "85%", height: "88%", borderRadius: 160, overflow: "hidden" },
  ring: { ...StyleSheet.absoluteFillObject },
  silhouette: { flex: 1, alignItems: "center", justifyContent: "flex-end", overflow: "hidden" },
  head: { width: 85, height: 110, borderRadius: 50, marginBottom: 8, opacity: 0.65 },
  shoulders: { width: 200, height: 100, borderTopLeftRadius: 100, borderTopRightRadius: 100, marginBottom: -20, opacity: 0.65 },
  status: { flexDirection: "row", alignItems: "center", gap: 8, maxWidth: 320 },
  statusDot: { width: 5, height: 5, borderRadius: 3 },
  statusText: { fontSize: 13, lineHeight: 20, flexShrink: 1, textAlign: "center" },
  progressArea: { width: "100%", maxWidth: 300, marginTop: 16, gap: 10 },
  count: { fontSize: 13, fontWeight: "600", textAlign: "center", fontVariant: ["tabular-nums"] },
  track: { height: 4, borderRadius: 3, overflow: "hidden" }, fill: { height: 4, borderRadius: 3 },
  actions: { width: "100%", maxWidth: 340, marginTop: 22, gap: 12 },
  privacy: { fontSize: 12, lineHeight: 18, textAlign: "center", marginTop: 20 },
});
