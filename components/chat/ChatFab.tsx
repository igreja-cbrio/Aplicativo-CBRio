import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Keyboard, Platform, StyleSheet, View, useWindowDimensions } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/contexts/ThemeContext";
import { radius, spacing } from "@/constants/theme";
import { FAB_PADRAO_ACIMA, FAB_POS_KEY, lerFabPos, limitesFab, posParaPx, pxParaPos, type FabPos } from "@/lib/fabPos";

const TAMANHO = 56;

/**
 * Botão flutuante que abre o assistente direto (/fale-conosco-chat).
 *
 * É arrastável: o toque abre o chat, o arrasto move o botão e, ao soltar, ele
 * gruda na borda esquerda/direita. A posição é lembrada em AsyncStorage como
 * borda + fração da altura útil (nunca pixels), e re-ajustada (clamp) quando a
 * tela/insets/dock mudam. Padrão: canto inferior direito, acima do dock.
 *
 * `bottomOffset` = altura do dock (BottomBar). Some com o teclado aberto.
 * Quem decide EM QUAIS telas aparece é o `app/(app)/_layout.tsx`.
 */
export function ChatFab({ bottomOffset = 0 }: { bottomOffset?: number }) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [teclado, setTeclado] = useState(false);
  // Posição lida/gravada fica em ref: salvar não pode re-disparar o efeito de
  // clamp (ele cancelaria a mola do snap). `lido` só avisa que o disco chegou.
  const posRef = useRef<FabPos | null>(null);
  const [lido, setLido] = useState(false);
  const salvarTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const lim = useMemo(
    () => limitesFab({ width, height, tamanho: TAMANHO, margem: spacing.md, insetTop: insets.top, insetBottom: insets.bottom, bottomOffset }),
    [width, height, insets.top, insets.bottom, bottomOffset],
  );

  const tx = useSharedValue(lim.xDir);
  const ty = useSharedValue(Math.max(lim.minY, lim.maxY - FAB_PADRAO_ACIMA));
  const ctxX = useSharedValue(0);
  const ctxY = useSharedValue(0);
  const limX = useSharedValue(lim.xEsq);
  const limX2 = useSharedValue(lim.xDir);
  const limY = useSharedValue(lim.minY);
  const limY2 = useSharedValue(lim.maxY);

  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow", () => setTeclado(true));
    const hide = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide", () => setTeclado(false));
    return () => { show.remove(); hide.remove(); };
  }, []);

  useEffect(() => {
    let vivo = true;
    AsyncStorage.getItem(FAB_POS_KEY)
      .then((raw) => { if (vivo) { posRef.current = lerFabPos(raw); setLido(true); } })
      .catch(() => {});
    return () => { vivo = false; if (salvarTimer.current) clearTimeout(salvarTimer.current); };
  }, []);

  // Re-aplica (com clamp) quando a posição lida ou os limites mudam.
  useEffect(() => {
    const p = posParaPx(posRef.current, lim);
    tx.value = p.x;
    ty.value = p.y;
    limX.value = lim.xEsq; limX2.value = lim.xDir; limY.value = lim.minY; limY2.value = lim.maxY;
  }, [lido, lim, tx, ty, limX, limX2, limY, limY2]);

  const abrir = useCallback(() => { router.navigate("/fale-conosco-chat"); }, []);

  const salvar = useCallback((x: number, y: number) => {
    const nova = pxParaPos(x, y, lim, TAMANHO);
    posRef.current = nova;
    if (salvarTimer.current) clearTimeout(salvarTimer.current);
    salvarTimer.current = setTimeout(() => {
      AsyncStorage.setItem(FAB_POS_KEY, JSON.stringify(nova)).catch(() => {});
    }, 300);
  }, [lim]);

  const gesto = useMemo(() => {
    const tap = Gesture.Tap().maxDistance(10).onEnd((_e, ok) => {
      if (ok) runOnJS(abrir)();
    });
    const pan = Gesture.Pan()
      .minDistance(8)
      .onStart(() => { ctxX.value = tx.value; ctxY.value = ty.value; })
      .onUpdate((e) => {
        tx.value = Math.min(limX2.value, Math.max(limX.value, ctxX.value + e.translationX));
        ty.value = Math.min(limY2.value, Math.max(limY.value, ctxY.value + e.translationY));
      })
      .onEnd(() => {
        const meio = (limX.value + limX2.value) / 2;
        const alvoX = tx.value > meio ? limX2.value : limX.value;
        tx.value = withSpring(alvoX, { damping: 18, stiffness: 180 });
        runOnJS(salvar)(alvoX, ty.value);
      });
    return Gesture.Race(tap, pan);
  }, [abrir, salvar, tx, ty, ctxX, ctxY, limX, limX2, limY, limY2]);

  const estilo = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value }],
  }));

  if (teclado) return null;

  return (
    // box-none: o contêiner não captura toques; só o botão.
    <View pointerEvents="box-none" style={styles.wrap}>
      <GestureDetector gesture={gesto}>
        <Animated.View
          accessible
          accessibilityRole="button"
          accessibilityLabel="Abrir chat com o assistente"
          accessibilityActions={[{ name: "activate" }]}
          onAccessibilityAction={abrir}
          style={[styles.fab, { backgroundColor: colors.primary }, estilo]}
        >
          <Ionicons name="chatbubble-ellipses" size={26} color="#fff" />
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { ...StyleSheet.absoluteFillObject, zIndex: 20, elevation: 8 },
  fab: {
    position: "absolute",
    left: 0,
    top: 0,
    width: TAMANHO,
    height: TAMANHO,
    borderRadius: radius.full,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 8,
  },
});
