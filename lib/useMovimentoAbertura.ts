import { useEffect, useRef } from "react";
import { AccessibilityInfo, Animated, AppState, Easing } from "react-native";

/** A abertura nunca espera a animação terminar para liberar o app. */
export function useMovimentoAbertura() {
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    let vivo = true;
    let recebeuPreferencia = false;
    let reduzir = true;
    let ativo = AppState.currentState === "active";
    let pulse: Animated.CompositeAnimation | undefined;

    function atualizar() {
      pulse?.stop();
      pulse = undefined;
      scale.setValue(1);
      if (!vivo || reduzir || !ativo) return;
      pulse = Animated.loop(Animated.sequence([
        Animated.timing(scale, {
          toValue: 1.025, duration: 1200,
          easing: Easing.inOut(Easing.sin), useNativeDriver: true, isInteraction: false,
        }),
        Animated.timing(scale, {
          toValue: 1, duration: 1200,
          easing: Easing.inOut(Easing.sin), useNativeDriver: true, isInteraction: false,
        }),
      ]));
      pulse.start();
    }

    const movimento = AccessibilityInfo.addEventListener("reduceMotionChanged", (value) => {
      recebeuPreferencia = true;
      reduzir = value;
      atualizar();
    });
    const estado = AppState.addEventListener("change", (value) => {
      ativo = value === "active";
      atualizar();
    });
    AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (!vivo || recebeuPreferencia) return;
      reduzir = value;
      atualizar();
    }).catch(() => { /* Sem preferência disponível, mantém a marca estática. */ });

    return () => {
      vivo = false;
      movimento.remove();
      estado.remove();
      pulse?.stop();
    };
  }, [scale]);

  return scale;
}
