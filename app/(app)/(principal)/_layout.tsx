import { Stack } from "expo-router";
import { AppScreenFrame } from "@/components/navigation/AppScreenFrame";
import { AppDockShell } from "@/components/navigation/AppDockShell";
import { TrocaDeAbaProvider } from "@/components/navigation/TrocaDeAba";

export const unstable_settings = { initialRouteName: "index" };

/** Casca persistente das telas principais; o chat é irmão deste Stack. */
export default function PrincipalLayout() {
  return <Stack
    // A barra (dentro do AppDockShell) troca de aba pela pilha deste Stack: memória por aba (lib/abas.ts).
    layout={({ state, navigation, children }) => <TrocaDeAbaProvider state={state} navigation={navigation}>
      <AppDockShell rota={state.routes[state.index].name}>{children}</AppDockShell>
    </TrocaDeAbaProvider>}
    screenLayout={({ route, children }) => <AppScreenFrame rota={route.name}>{children}</AppScreenFrame>}
    screenOptions={{ headerShown: false, freezeOnBlur: true, animation: "ios_from_right", animationDuration: 180 }}
  >
    {/* Abas irmãs trocam na hora; telas de detalhe conservam o gesto nativo. */}
    <Stack.Screen name="index" options={{ animation: "none" }} />
    <Stack.Screen name="meu-grupo" options={{ animation: "none" }} />
    <Stack.Screen name="voluntariado" options={{ animation: "none" }} />
    <Stack.Screen name="cuidados" options={{ animation: "none" }} />
    <Stack.Screen name="devocional" options={{ animation: "none" }} />
    <Stack.Screen name="generosidade" options={{ animation: "none" }} />
    <Stack.Screen name="menu" options={{ animation: "none" }} />
  </Stack>;
}
