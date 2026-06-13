import { Stack } from "expo-router";
import { MembroProvider } from "@/contexts/MembroContext";

/**
 * Área autenticada: Stack raiz com o grupo (tabs) — tab bar NATIVA
 * (ver (tabs)/_layout.tsx) — e as demais telas como push de verdade
 * por cima das abas (perfil, cartões, batismo, devocional, etc.).
 */
export default function AppLayout() {
  return (
    <MembroProvider>
      <Stack
        screenOptions={{
          headerShown: false,
          animation: "ios_from_right",
          animationDuration: 280,
        }}
      >
        <Stack.Screen name="(tabs)" />
      </Stack>
    </MembroProvider>
  );
}
