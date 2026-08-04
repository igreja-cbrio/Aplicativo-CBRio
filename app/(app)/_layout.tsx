import { Stack } from "expo-router";
import { MembroProvider } from "@/contexts/MembroContext";
import { CadastroGate } from "@/components/auth/CadastroGate";

/**
 * Área autenticada: Stack raiz com o grupo (tabs) — tab bar NATIVA
 * (ver (tabs)/_layout.tsx) — e as demais telas como push de verdade
 * por cima das abas (perfil, cartões, batismo, devocional, etc.).
 */
export default function AppLayout() {
  return (
    <MembroProvider>
      {/* Portão de cadastro: quem entrou sem cadastro de gente (nome real +
          telefone + nascimento) é levado a /completar-cadastro. Não bloqueia
          render — só navega quando o servidor confirma que falta algo. */}
      <CadastroGate>
        <Stack
          screenOptions={{
            headerShown: false,
            animation: "ios_from_right",
            animationDuration: 280,
          }}
        >
          <Stack.Screen name="(tabs)" />
        </Stack>
      </CadastroGate>
    </MembroProvider>
  );
}
