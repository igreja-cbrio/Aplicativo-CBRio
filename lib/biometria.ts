import AsyncStorage from "@react-native-async-storage/async-storage";
import * as LocalAuthentication from "expo-local-authentication";
import { Platform } from "react-native";

/**
 * Desbloqueio rápido por biometria (Face ID / Touch ID).
 *
 * A sessão do Supabase já fica persistida com segurança (storage híbrido
 * quando "lembrar de mim" está ligado). A biometria só serve de porteiro:
 * ao reabrir o app, em vez de digitar e-mail/senha, o usuário desbloqueia
 * com o rosto/digital. O segredo da sessão NÃO passa por aqui.
 */

const BIOM_PREF_KEY = "cbrio:biometria_unlock";

/** Há sensor biométrico no aparelho E o usuário tem biometria cadastrada? */
export async function biometriaSuportada(): Promise<boolean> {
  try {
    const temHw = await LocalAuthentication.hasHardwareAsync();
    const cadastrada = await LocalAuthentication.isEnrolledAsync();
    return temHw && cadastrada;
  } catch {
    return false;
  }
}

/** Rótulo amigável do método disponível (Face ID, Touch ID, etc.). */
export async function rotuloBiometria(): Promise<string> {
  try {
    const tipos =
      await LocalAuthentication.supportedAuthenticationTypesAsync();
    if (
      tipos.includes(
        LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION
      )
    ) {
      return "Face ID";
    }
    if (tipos.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
      return Platform.OS === "ios" ? "Touch ID" : "Impressão digital";
    }
    if (tipos.includes(LocalAuthentication.AuthenticationType.IRIS)) {
      return "Íris";
    }
  } catch {
    /* fallback abaixo */
  }
  return "biometria";
}

/** Dispara a folha nativa de autenticação. `true` = autenticado. */
export async function autenticarBiometria(motivo: string): Promise<boolean> {
  try {
    const res = await LocalAuthentication.authenticateAsync({
      promptMessage: motivo,
      cancelLabel: "Cancelar",
      // Permite cair no código do aparelho se a biometria falhar repetidas vezes.
      disableDeviceFallback: false,
    });
    return res.success;
  } catch {
    return false;
  }
}

/** Preferência: o usuário ativou o desbloqueio por biometria? */
export async function biometriaAtiva(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(BIOM_PREF_KEY)) === "true";
  } catch {
    return false;
  }
}

export async function definirBiometriaAtiva(ativa: boolean): Promise<void> {
  try {
    if (ativa) await AsyncStorage.setItem(BIOM_PREF_KEY, "true");
    else await AsyncStorage.removeItem(BIOM_PREF_KEY);
  } catch {
    /* no-op */
  }
}
