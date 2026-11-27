import { createContext, useCallback, useContext, useRef, type ReactNode } from "react";
import { CommonActions, type NavigationState, type ParamListBase, type NavigationHelpers } from "@react-navigation/native";
import { trocarDeAba } from "@/lib/abas";

/**
 * Aplica `lib/abas.ts` na pilha das telas principais (memória por aba · 27/11/2026).
 *
 * ⚠️ É `reset` com as MESMAS rotas (mesma `key`), só reordenadas: o React
 * Navigation mantém cada tela montada e o react-native-screens reordena as
 * telas nativas (iOS: `setViewControllers` sem animação; Android: a tela que
 * sobe é reanexada como num "voltar"). Nada é recriado nem recarregado.
 * ⚠️ Não trocar por `navigate`/`dismissTo`: o primeiro empilha cópia nova e o
 * segundo DESTRÓI o que está acima do destino (ver o cabeçalho de lib/abas.ts).
 */
type Trocar = (destino: string) => void;
const TrocaDeAbaContext = createContext<Trocar | null>(null);

export function TrocaDeAbaProvider({ state, navigation, children }: {
  state: NavigationState;
  navigation: NavigationHelpers<ParamListBase>;
  children: ReactNode;
}) {
  // O toque lê a pilha do MOMENTO do toque, não a de quando o callback nasceu.
  const atual = useRef(state);
  atual.current = state;
  const trocar = useCallback((destino: string) => {
    const pilha = atual.current;
    const troca = trocarDeAba(pilha.routes, destino);
    if (troca.tipo === "nada") return;
    try {
      require("expo-haptics").selectionAsync?.().catch?.(() => {});
    } catch {
      /* sem haptics neste ambiente */
    }
    const rotas = troca.rotas as NavigationState["routes"];
    navigation.dispatch(CommonActions.reset({ ...pilha, routes: rotas, index: rotas.length - 1 }));
  }, [navigation]);
  return <TrocaDeAbaContext.Provider value={trocar}>{children}</TrocaDeAbaContext.Provider>;
}

/** `null` fora das telas principais: quem chama cai no `irParaBarra` de sempre. */
export function useTrocaDeAba() {
  return useContext(TrocaDeAbaContext);
}
