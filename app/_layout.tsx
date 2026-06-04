import { useEffect, useState } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import * as Notifications from "expo-notifications";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ThemeProvider, useTheme } from "@/contexts/ThemeContext";
import { SplashPulse } from "@/components/brand/SplashPulse";
import { registerForPush } from "@/lib/push";
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
  const { session, loading, preview } = useAuth();
  const { colors, mode } = useTheme();
  const segments = useSegments();
  const router = useRouter();
  const authed = !!session || preview;

  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === "(auth)";

    if (!authed && !inAuthGroup) {
      router.replace("/(auth)/login");
    } else if (authed && inAuthGroup) {
      router.replace("/(app)");
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

  if (loading) {
    return <SplashPulse />;
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
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <RootNavigator />
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
