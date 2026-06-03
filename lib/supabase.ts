import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    "[supabase] EXPO_PUBLIC_SUPABASE_URL ou EXPO_PUBLIC_SUPABASE_ANON_KEY ausentes. " +
      "Copie .env.example para .env e preencha as credenciais."
  );
}

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

export const supabase = createClient(supabaseUrl ?? "", supabaseAnonKey ?? "", {
  auth: {
    storage: hybridStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
