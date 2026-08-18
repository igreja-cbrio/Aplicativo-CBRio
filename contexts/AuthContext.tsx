import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Platform } from "react-native";
import * as WebBrowser from "expo-web-browser";
import * as AuthSession from "expo-auth-session";
import * as AppleAuthentication from "expo-apple-authentication";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Session, User } from "@supabase/supabase-js";
import {
  supabase,
  setRememberSession,
  REMEMBER_PREF_KEY,
} from "@/lib/supabase";
import { limparCache } from "@/lib/cache";
import { trackEvento } from "@/lib/telemetria";
import { definirBiometriaAtiva } from "@/lib/biometria";
import { unregisterPush } from "@/lib/push";

WebBrowser.maybeCompleteAuthSession();

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  rememberPref: boolean;
  /** Preview só em dev: visualizar a área logada sem Supabase. */
  preview: boolean;
  enterPreview: () => void;
  signIn: (email: string, password: string, remember: boolean) => Promise<void>;
  signUp: (
    email: string,
    password: string,
    profile: {
      nome: string;
      cpf: string;
      dataNascimento: string; // ISO AAAA-MM-DD
      telefone: string; // E.164, ex.: +5521999999999
      // ⚠️ Canônico `masculino|feminino`, NUNCA "outro" (lei do contrato).
      sexo?: "masculino" | "feminino" | null;
      frequentaArea?: "ami" | "bridge" | null; // ministério auto-declarado
    }
  ) => Promise<{ needsEmailConfirmation: boolean }>;
  signUpWithPhone: (
    nome: string,
    email: string,
    phone: string,
    password: string
  ) => Promise<void>;
  verifyPhoneOtp: (phone: string, token: string) => Promise<void>;
  resendPhoneOtp: (phone: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signInWithApple: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updatePassword: (novaSenha: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function ehRateLimit(error: unknown): boolean {
  const e = error as { status?: number; code?: string; message?: string } | null;
  return (
    e?.status === 429 ||
    e?.code === "over_request_rate_limit" ||
    /rate limit|too many requests/i.test(e?.message ?? "")
  );
}

/**
 * Login com retry + backoff em caso de 429 (rate limit do Auth) — comum
 * quando muita gente entra ao mesmo tempo na mesma rede (ex.: WiFi da
 * igreja no culto, todos atrás de um IP). Espera crescente e tenta de novo.
 */
async function signInComBackoff(email: string, password: string) {
  const esperas = [1200, 2500, 4000]; // ms
  for (let tent = 0; tent <= esperas.length; tent++) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (!error) return;
    if (ehRateLimit(error) && tent < esperas.length) {
      await new Promise((r) => setTimeout(r, esperas[tent]));
      continue;
    }
    throw error;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [rememberPref, setRememberPref] = useState(true);
  const [preview, setPreview] = useState(false);

  useEffect(() => {
    (async () => {
      const pref = await AsyncStorage.getItem(REMEMBER_PREF_KEY);
      if (pref !== null) {
        const value = pref === "true";
        setRememberPref(value);
        setRememberSession(value);
      }
      const { data } = await supabase.auth.getSession();
      setSession(data.session);
      setLoading(false);
    })();

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, newSession) => setSession(newSession)
    );
    return () => listener.subscription.unsubscribe();
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      loading,
      rememberPref,
      preview,
      enterPreview() {
        if (__DEV__) setPreview(true);
      },
      async signIn(email, password, remember) {
        setRememberSession(remember);
        setRememberPref(remember);
        await AsyncStorage.setItem(REMEMBER_PREF_KEY, String(remember));
        await signInComBackoff(email.trim(), password);
      },
      async signUp(email, password, profile) {
        // Cadastro por e-mail/senha (sem SMS). Dados do perfil vão nos
        // metadados e caem na tabela `profiles` pelo trigger.
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: {
              nome: profile.nome.trim(),
              cpf: profile.cpf,
              data_nascimento: profile.dataNascimento,
              telefone: profile.telefone,
              // `genero` é o nome da coluna em mem_membros — é a chave que o
              // trigger handle_new_user lê (patchado em 05/08 pra gravá-la).
              genero: profile.sexo ?? null,
              frequenta_area: profile.frequentaArea ?? null,
              origem: "app", // distingue cadastro nativo de logins web/magic-link
            },
          },
        });
        if (error) throw error;
        // Sem sessão = o projeto exige confirmação de e-mail.
        return { needsEmailConfirmation: !data.session };
      },
      async signUpWithPhone(nome, email, phone, password) {
        // Cria a conta com e-mail/senha e telefone; o Supabase envia o SMS.
        const { error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          phone: phone.trim(),
          options: { data: { nome: nome.trim() } },
        });
        if (error) throw error;
      },
      async verifyPhoneOtp(phone, token) {
        const { error } = await supabase.auth.verifyOtp({
          phone: phone.trim(),
          token: token.trim(),
          type: "sms",
        });
        if (error) throw error;
      },
      async resendPhoneOtp(phone) {
        const { error } = await supabase.auth.resend({
          type: "sms",
          phone: phone.trim(),
        });
        if (error) throw error;
      },
      async signInWithGoogle() {
        const redirectTo = AuthSession.makeRedirectUri({ scheme: "cbrio" });
        const { data, error } = await supabase.auth.signInWithOAuth({
          provider: "google",
          options: { redirectTo, skipBrowserRedirect: true },
        });
        if (error) throw error;
        if (!data.url) throw new Error("Não foi possível iniciar o login.");

        const result = await WebBrowser.openAuthSessionAsync(
          data.url,
          redirectTo
        );

        // ⚠️⚠️ AQUI ESTAVAM DUAS SAÍDAS MUDAS (relato do Marcos · 18/08: "cliquei
        // em logar pelo Google, carregou e voltou para a página inicial, não me
        // colocou nenhum dado pra preencher, só travou meu acesso").
        //
        //  1. `if (result.type !== "success") return;` — comentado como "usuário
        //     cancelou", mas o `dismiss` do Android também acontece quando o
        //     retorno não casa com o `redirectTo`. Quem não cancelou nada só via
        //     a tela de login de volta.
        //  2. Sem token no hash, o `if` simplesmente não entrava: nenhuma
        //     sessão, nenhum erro, nenhuma pista.
        //
        // Medido na telemetria: a sessão do aparelho dele registrou `/` e
        // `/login` 16× cada com `user_id` VAZIO — nunca houve sessão. É raro
        // (3 sessões em 14 dias contra 42 aparelhos que entraram), mas quando
        // acontece a pessoa fica sem nenhuma informação.
        if (result.type !== "success") {
          trackEvento("login_provider_sem_retorno", { label: result.type });
          throw new Error(
            "O login não foi concluído. Se você fechou a janela do Google, tente de novo; se ela fechou sozinha, avise a equipe."
          );
        }

        // ⚠️ Lê hash E query: o fluxo implícito devolve no hash, o PKCE devolve
        // `?code=` na query, e o provedor devolve `error_description` em
        // qualquer um dos dois. Ler só o hash era o que engolia o motivo.
        const devolvido = new URL(result.url);
        const doHash = new URLSearchParams(devolvido.hash.replace(/^#/, ""));
        const pega = (k: string) => doHash.get(k) ?? devolvido.searchParams.get(k);

        const erroProvedor = pega("error_description") || pega("error");
        if (erroProvedor) {
          trackEvento("login_provider_recusou", { label: pega("error") || "erro" });
          throw new Error(decodeURIComponent(erroProvedor).replace(/[+]/g, " "));
        }

        const access_token = pega("access_token");
        const refresh_token = pega("refresh_token");
        if (access_token && refresh_token) {
          const { error: sessErr } = await supabase.auth.setSession({
            access_token,
            refresh_token,
          });
          if (sessErr) throw sessErr;
          return;
        }

        // Defensivo: se um dia o cliente passar a usar PKCE, o retorno vira
        // `?code=` e o caminho de cima não acharia token nenhum.
        const code = pega("code");
        if (code) {
          const { error: codeErr } = await supabase.auth.exchangeCodeForSession(code);
          if (codeErr) throw codeErr;
          return;
        }

        trackEvento("login_provider_sem_sessao", { label: "sem_token" });
        throw new Error(
          "O Google respondeu, mas o aplicativo não recebeu a sessão. Tente de novo; se persistir, avise a equipe."
        );
      },
      async signInWithApple() {
        if (Platform.OS !== "ios") {
          throw new Error("Login com Apple disponível apenas no iOS.");
        }
        const credential = await AppleAuthentication.signInAsync({
          requestedScopes: [
            AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
            AppleAuthentication.AppleAuthenticationScope.EMAIL,
          ],
        });
        if (!credential.identityToken) {
          throw new Error("Não foi possível obter o token da Apple.");
        }
        const { error } = await supabase.auth.signInWithIdToken({
          provider: "apple",
          token: credential.identityToken,
        });
        if (error) throw error;
      },
      async resetPassword(email) {
        // redirectTo deep link: sem ele o Supabase usa a site_url do projeto
        // (https://www.cbrio.org — o sistema interno) e o usuário cai fora
        // do app. cbrio://redefinir-senha está na allowlist do Auth.
        const { error } = await supabase.auth.resetPasswordForEmail(
          email.trim(),
          { redirectTo: "cbrio://redefinir-senha" }
        );
        if (error) throw error;
      },
      async updatePassword(novaSenha) {
        const { error } = await supabase.auth.updateUser({ password: novaSenha });
        if (error) throw error;
      },
      async signOut() {
        setPreview(false);
        await limparCache(); // descarta cache local (destaques/cultos) da sessão
        await definirBiometriaAtiva(false); // cada conta reativa o desbloqueio
        // Remove o push token deste aparelho ANTES de derrubar a sessão (a RLS
        // de delete exige o dono logado) — senão o token fica órfão e a conta
        // antiga/excluída seguiria recebendo pushes neste aparelho.
        await unregisterPush();
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
      },
    }),
    [session, loading, rememberPref, preview]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth deve ser usado dentro de <AuthProvider>");
  return ctx;
}
