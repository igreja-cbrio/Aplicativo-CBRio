import { guardarConviteSupervisor, lerConviteSupervisor } from '@/lib/supervisorConvitePendente';
import { tokenSupervisor, destinoSupervisor, conviteDaUrl } from '@/lib/supervisorConvite';
import { useEffect, useState } from "react";
import { AppState, Linking } from "react-native";
import { Stack, useRouter, useSegments, usePathname, useGlobalSearchParams } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import * as Notifications from "expo-notifications";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ThemeProvider, useTheme } from "@/contexts/ThemeContext";
import { TranslationProvider } from "@/lib/i18n";
import { SplashPulse } from "@/components/brand/SplashPulse";
import { BiometriaLock } from "@/components/auth/BiometriaLock";
import { PortaoAtualizacao } from "@/components/app/PortaoAtualizacao";
import { ErrorBoundary } from "@/components/app/ErrorBoundary";
import { Onboarding } from "@/components/onboarding/Onboarding";
import { biometriaAtiva } from "@/lib/biometria";
import { onboardingVisto, marcarOnboardingVisto } from "@/lib/onboarding";
import { ConviteNotificacoes } from "@/components/notificacoes/ConviteNotificacoes";
import { registerForPush } from "@/lib/push";
import { initTelemetria, trackTela } from "@/lib/telemetria";
import { limparSobrasNaAbertura } from "@/lib/limparSobrasCamera";
import { attachNotifTapListener } from "@/lib/notifTap";
import { loadFontScale } from "@/lib/applyFontScale";
import { useFontsCbrio } from "@/lib/fonts";

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
  const params = useGlobalSearchParams();
  const conviteSupervisor = pathname === "/voluntariado" ? tokenSupervisor(params.convite) : null;
  const authed = !!session || preview;
  const [conviteLinkPronto, setConviteLinkPronto] = useState(false);
  useEffect(() => {
    let vivo = true;
    let recebeuLink = false;
    const guardarUrl = async (url: string | null) => {
      const token = url ? conviteDaUrl(url) : null;
      if (token) await guardarConviteSupervisor(token).catch(() => {});
    };
    const listener = Linking.addEventListener("url", ({ url }) => {
      recebeuLink = true;
      void guardarUrl(url);
    });
    void Linking.getInitialURL().then(url => recebeuLink ? undefined : guardarUrl(url)).catch(() => {}).finally(() => { if (vivo) setConviteLinkPronto(true); });
    return () => { vivo = false; listener.remove(); };
  }, []);
  const recoveryScreen = pathname === "/redefinir-senha" || pathname === "/recuperar-senha";

  // Telemetria: inicializa 1x (handler de erros + flush) e registra cada tela.
  useEffect(() => { initTelemetria(); }, []);
  // Selfie da busca por rosto que ficou no cache porque o Android matou o app
  // com a câmera aberta (o texto do aceite promete apagar). Ver o arquivo.
  useEffect(() => { limparSobrasNaAbertura(); }, []);
  useEffect(() => { if (pathname) trackTela(pathname); }, [pathname]);

  // Desbloqueio por biometria: trava UMA vez por abertura do app quando há
  // sessão salva e o usuário ativou a opção. null = ainda decidindo.
  const [precisaBiometria, setPrecisaBiometria] = useState<boolean | null>(null);
  const [desbloqueado, setDesbloqueado] = useState(false);
  const [biometriaResolvidaPara, setBiometriaResolvidaPara] = useState<string | null>(null);
  // Onboarding: mostra 1x pra quem nunca viu (após logar). null = decidindo.
  const [mostrarOnboarding, setMostrarOnboarding] = useState<boolean | null>(null);
  const [onboardingResolvidoPara, setOnboardingResolvidoPara] = useState<string | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!session || preview) {
      setPrecisaBiometria(false);
      return;
    }
    let cancelado = false;
    const identidade = session.user.id;
    setBiometriaResolvidaPara(null);
    biometriaAtiva().then((ativa) => {
      if (cancelado) return;
      setPrecisaBiometria(ativa);
      setBiometriaResolvidaPara(identidade);
    });
    return () => { cancelado = true; };
  }, [loading, session?.user?.id, preview]);

  useEffect(() => {
    if (loading) return;
    if (!authed) {
      setMostrarOnboarding(false);
      return;
    }
    let cancelado = false;
    const identidade = session?.user?.id ?? null;
    setOnboardingResolvidoPara(null);
    onboardingVisto().then((visto) => {
      if (cancelado) return;
      setMostrarOnboarding(!visto);
      setOnboardingResolvidoPara(identidade);
    });
    return () => { cancelado = true; };
  }, [loading, authed, session?.user?.id]);

  useEffect(() => {
    if (loading) return;

    if (!conviteLinkPronto) return;
    const inAuthGroup = segments[0] === "(auth)";
    // Recuperação é pública, inclusive com outra conta conectada. A sessão
    // do link fica isolada; o guard não deve expulsar a pessoa desse fluxo.
    const inRedefinirSenha = segments.includes("redefinir-senha" as never) || segments.includes("recuperar-senha" as never);

    let vivo = true;
    async function navegar() {
      if (conviteSupervisor) await guardarConviteSupervisor(conviteSupervisor).catch(() => {});
      if (!vivo) return;
      if (!authed && !inAuthGroup) {
        router.replace("/(auth)/login");
      } else if (authed && inAuthGroup && !inRedefinirSenha) {
        const destino = destinoSupervisor(await lerConviteSupervisor());
        if (vivo) router.replace((destino || "/") as any);
      }
    }
    void navegar();
    return () => { vivo = false; };
  }, [authed, loading, segments, conviteSupervisor, router, conviteLinkPronto]);

  // Registra o dispositivo para push quando há sessão real.
  //
  // ⚠️ E TENTA DE NOVO na volta do background (07/08/2026): a dependência é só
  // o id da sessão, então uma falha de rede no boot ficava PERMANENTE — o
  // registro não era tentado outra vez até a pessoa deslogar e logar. Como o
  // `upsert` é por `token` (`onConflict`), repetir não cria linha duplicada.
  const uid = session?.user?.id;
  useEffect(() => {
    if (!uid) return;
    registerForPush(uid);
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") registerForPush(uid);
    });
    return () => sub.remove();
  }, [uid]);

  // Só consome o toque quando a navegação existe e os portões terminaram.
  // Antes disso, a resposta nativa fica pendente para a abertura após login/desbloqueio.
  const podeAbrirNotificacao = !!uid && !loading && !preview && !recoveryScreen
    && segments[0] !== "(auth)" && mostrarOnboarding === false
    && onboardingResolvidoPara === uid && biometriaResolvidaPara === uid
    && precisaBiometria !== null && (!precisaBiometria || desbloqueado);
  useEffect(() => {
    if (!podeAbrirNotificacao) return;
    const detach = attachNotifTapListener();
    return detach;
  }, [podeAbrirNotificacao, uid]);

  if (loading || (session && !preview && precisaBiometria === null && !recoveryScreen)) {
    return <SplashPulse />;
  }

  // Sessão salva + biometria ativa + ainda não desbloqueou nesta abertura.
  if (session && !preview && precisaBiometria && !desbloqueado && !recoveryScreen) {
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
  if (authed && mostrarOnboarding && !recoveryScreen) {
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
      {!!uid && !preview && !recoveryScreen && mostrarOnboarding === false && onboardingResolvidoPara === uid && biometriaResolvidaPara === uid && <ConviteNotificacoes key={uid} userId={uid} />}
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
  if (!fontScaleReady || !fontsLoaded) return null;
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      {/* ⚠️ ERROR BOUNDARY NA RAIZ, FORA de todos os providers (06/08/2026).
          O app não tinha NENHUM: qualquer exceção de render subia até a raiz e o
          React Native FECHAVA o app, sem mensagem (o handler da telemetria
          registra o fatal e repassa pro padrão — a gente sabia do crash e a
          pessoa ficava sem app). Fica aqui fora pra cobrir erro do tema, da
          tradução, do portão de atualização e do auth também; por isso as cores
          da tela de erro são fixas, e não do tema. */}
      <ErrorBoundary>
      <SafeAreaProvider>
        <TranslationProvider>
          <ThemeProvider>
            {/* ⚠️ PORTÃO DE ATUALIZAÇÃO acima de TUDO (inclusive do login):
                decisão do Marcos — "se não atualizar não usa". Fica fora do
                AuthProvider de propósito: não depende de sessão, e assim a pessoa
                não consegue nem logar com bundle velho. Só bloqueia quando o
                update JÁ está baixado (ver o arquivo do componente). */}
            <PortaoAtualizacao>
              <AuthProvider>
                <RootNavigator />
              </AuthProvider>
            </PortaoAtualizacao>
          </ThemeProvider>
        </TranslationProvider>
      </SafeAreaProvider>
      </ErrorBoundary>
    </GestureHandlerRootView>
  );
}
