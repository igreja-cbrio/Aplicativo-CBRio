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
    nome: string,
    email: string,
    password: string,
    phone?: string
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
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

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
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) throw error;
      },
      async signUp(nome, email, password, phone) {
        // Cadastro por e-mail/senha (sem SMS). O telefone, se informado,
        // fica nos metadados para o perfil.
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: { nome: nome.trim(), telefone: phone?.trim() || null },
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
        if (result.type !== "success") return; // usuário cancelou

        const params = new URL(result.url).hash.replace(/^#/, "");
        const search = new URLSearchParams(params);
        const access_token = search.get("access_token");
        const refresh_token = search.get("refresh_token");
        if (access_token && refresh_token) {
          const { error: sessErr } = await supabase.auth.setSession({
            access_token,
            refresh_token,
          });
          if (sessErr) throw sessErr;
        }
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
        const { error } = await supabase.auth.resetPasswordForEmail(
          email.trim()
        );
        if (error) throw error;
      },
      async signOut() {
        setPreview(false);
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
