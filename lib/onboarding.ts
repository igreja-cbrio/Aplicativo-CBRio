import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "cbrio:onboarding_visto:v1";

/** Já viu o onboarding? */
export async function onboardingVisto(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(KEY)) === "true";
  } catch {
    return true; // em dúvida, não bloqueia o app
  }
}

/** Marca o onboarding como visto (não mostra de novo). */
export async function marcarOnboardingVisto(): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, "true");
  } catch {
    /* ignora */
  }
}
