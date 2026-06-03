import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  // Log discreto (não abre overlay de warning no dev). Sem .env o app sobe
  // normalmente, mas a autenticação real não funciona — preencha .env quando for plugar o Supabase.
  console.log(
    "[supabase] Sem EXPO_PUBLIC_SUPABASE_URL/ANON_KEY (.env). " +
      "App roda em modo sem backend; auth real desativada."
  );
}

// Placeholders válidos para o app subir sem .env (ex.: preview da UI).
// O cliente Supabase lança erro se a URL/Key forem vazias.
const FALLBACK_URL = "https://placeholder.supabase.co";
const FALLBACK_ANON_KEY = "placeholder-anon-key";

/**
 * Storage híbrido para o "Lembrar de mim".
 * - remember = true  -> grava no AsyncStorage (persiste após fechar o app)
 * - remember = false -> mantém só em memória (some ao reiniciar o app)
 *
 * O flag é definido antes do login. Em um cold start ele volta a `true`,
 * então uma sessão "lembrada" é restaurada do AsyncStorage normalmente; uma
 * sessão "não lembrada" não existe lá e o usuário precisa logar de novo.
 */
const memoryStore = new Map<string, string>();
let remember = true;

export function setRememberSession(value: boolean) {
  remember = value;
}

export const REMEMBER_PREF_KEY = "cbrio.rememberPref";

const hybridStorage = {
  getItem: (key: string) =>
    remember
      ? AsyncStorage.getItem(key)
      : Promise.resolve(memoryStore.get(key) ?? null),
  setItem: (key: string, value: string) => {
    if (remember) return AsyncStorage.setItem(key, value);
    memoryStore.set(key, value);
    return Promise.resolve();
  },
  removeItem: (key: string) => {
    memoryStore.delete(key);
    return AsyncStorage.removeItem(key);
  },
};

export const supabase = createClient(
  supabaseUrl || FALLBACK_URL,
  supabaseAnonKey || FALLBACK_ANON_KEY,
  {
  auth: {
    storage: hybridStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
