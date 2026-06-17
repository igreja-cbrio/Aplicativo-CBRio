import { useEffect, useState } from "react";
import { Stack, useRouter, useSegments, usePathname } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import * as Notifications from "expo-notifications";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ThemeProvider, useTheme } from "@/contexts/ThemeContext";
import { TranslationProvider } from "@/lib/i18n";
import { SplashPulse } from "@/components/brand/SplashPulse";
import { BiometriaLock } from "@/components/auth/BiometriaLock";
import { Onboarding } from "@/components/onboarding/Onboarding";
import { biometriaAtiva } from "@/lib/biometria";
import { onboardingVisto, marcarOnboardingVisto } from "@/lib/onboarding";
import { registerForPush } from "@/lib/push";
import { initTelemetria, trackTela } from "@/lib/telemetria";
import { attachNotifTapListener } from "@/lib/notifTap";
import { loadFontScale } from "@/lib/applyFontScale";
import { useFontsCbrio, applyCbrioFontGlobally } from "@/lib/fonts";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// Carrega a escala de fonte salva ANTES dos providers renderizarem.
let fontScaleLoaded = false;
function useFontScaleBootstrap() {
  const [ready, setReady] = useState(fontScaleLoaded);
  useEffect(() => {
    if (fontScaleLoaded) return;
    loadFontScale().finally(() => {
      fontScaleLoaded = true;
      setReady(true);
    });
  }, []);
  return ready;
}

function RootNavigator() {
  const { session, loading, preview, signOut } = useAuth();
  const { colors, mode } = useTheme();
  const segments = useSegments();
  const router = useRouter();
  const pathname = usePathname();
  const authed = !!session || preview;

  // Telemetria: inicializa 1x (handler de erros + flush) e registra cada tela.
  useEffect(() => { initTelemetria(); }, []);
  useEffect(() => { if (pathname) trackTela(pathname); }, [pathname]);

  // Desbloqueio por biometria: trava UMA vez por abertura do app quando há
  // sessão salva e o usuário ativou a opção. null = ainda decidindo.
  const [precisaBiometria, setPrecisaBiometria] = useState<boolean | null>(null);
  const [desbloqueado, setDesbloqueado] = useState(false);
  // Onboarding: mostra 1x pra quem nunca viu (após logar). null = decidindo.
  const [mostrarOnboarding, setMostrarOnboarding] = useState<boolean | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!session || preview) {
      setPrecisaBiometria(false);
      return;
    }
    biometriaAtiva().then((ativa) => setPrecisaBiometria(ativa));
  }, [loading, session, preview]);

  useEffect(() => {
    if (loading) return;
    if (!authed) {
      setMostrarOnboarding(false);
      return;
    }
    onboardingVisto().then((visto) => setMostrarOnboarding(!visto));
  }, [loading, authed]);

  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === "(auth)";
    // Redefinição de senha: o deep link cria sessão ANTES do usuário digitar
    // a nova senha — não pode ser expulso da tela pelo redirect de authed.
    const inRedefinirSenha = segments.includes("redefinir-senha" as never);

    if (!authed && !inAuthGroup) {
      router.replace("/(auth)/login");
    } else if (authed && inAuthGroup && !inRedefinirSenha) {
      router.replace("/");
    }
  }, [authed, loading, segments]);

  // Registra o dispositivo para push quando há sessão real.
  useEffect(() => {
    if (session?.user?.id) registerForPush(session.user.id);
  }, [session?.user?.id]);

  // Listener de tap em notificações -> roteia pra tela certa.
  useEffect(() => {
    const detach = attachNotifTapListener();
    return detach;
  }, []);

  if (loading || (session && !preview && precisaBiometria === null)) {
    return <SplashPulse />;
  }

  // Sessão salva + biometria ativa + ainda não desbloqueou nesta abertura.
  if (session && !preview && precisaBiometria && !desbloqueado) {
    return (
      <>
        <StatusBar style={mode === "light" ? "dark" : "light"} />
        <BiometriaLock
          onUnlock={() => setDesbloqueado(true)}
          onSair={() => {
            setDesbloqueado(true); // libera a navegação pro login
            signOut();
          }}
        />
      </>
    );
  }

  // Onboarding 1x pra novos usuários (depois da biometria, antes do app).
  if (authed && mostrarOnboarding) {
    return (
      <>
        <StatusBar style={mode === "light" ? "dark" : "light"} />
        <Onboarding
          onConcluir={() => {
            marcarOnboardingVisto();
            setMostrarOnboarding(false);
          }}
        />
      </>
    );
  }

  return (
    <>
      <StatusBar style={mode === "light" ? "dark" : "light"} />
      <Stack
        screenOptions={{
          headerShown: false,
          animation: "ios_from_right",
          animationDuration: 280,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(app)" />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  const fontScaleReady = useFontScaleBootstrap();
  const fontsLoaded = useFontsCbrio();
  if (fontsLoaded) applyCbrioFontGlobally();
  if (!fontScaleReady || !fontsLoaded) return null;
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <TranslationProvider>
          <ThemeProvider>
            <AuthProvider>
              <RootNavigator />
            </AuthProvider>
          </ThemeProvider>
        </TranslationProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
