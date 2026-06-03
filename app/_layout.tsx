import { useEffect } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import * as Notifications from "expo-notifications";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ThemeProvider, useTheme } from "@/contexts/ThemeContext";
import { SplashPulse } from "@/components/brand/SplashPulse";
import { registerForPush } from "@/lib/push";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

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

  if (loading) {
    return <SplashPulse />;
  }

  return (
    <>
      <StatusBar style={mode === "light" ? "dark" : "light"} />
      <Stack
        screenOptions={{
          headerShown: false,
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
