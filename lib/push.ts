import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { supabase } from "./supabase";

/**
 * Registra o dispositivo para receber push e salva o Expo push token em
 * `app_push_tokens` (vinculado ao usuário e ao membro). O backend do sistema
 * dispara o push ao criar uma escala (ver supabase/functions/notify-escala).
 *
 * Observações:
 * - Push **não funciona no simulador iOS** (a obtenção do token falha e é
 *   ignorada silenciosamente).
 * - Requer um `projectId` do EAS (app.json extra.eas.projectId, via `eas init`).
 */
export async function registerForPush(userId: string): Promise<string | null> {
  try {
    // Android: canal "default" com o som elegante da marca (o som de push no
    // Android é definido por canal, não pelo payload).
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "CBRio",
        importance: Notifications.AndroidImportance.HIGH,
        sound: "cbrio_chime.wav",
        vibrationPattern: [0, 250, 250, 250],
      });
    }

    const { status: existing } = await Notifications.getPermissionsAsync();
    let status = existing;
    if (existing !== "granted") {
      const req = await Notifications.requestPermissionsAsync();
      status = req.status;
    }
    if (status !== "granted") return null;

    const projectId =
      (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)
        ?.eas?.projectId ?? (Constants as { easConfig?: { projectId?: string } }).easConfig?.projectId;
    if (!projectId) {
      console.log("[push] sem EAS projectId (rode `eas init`) — token não obtido.");
      return null;
    }

    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
    const token = tokenData.data;

    const { data: prof } = await supabase
      .from("profiles")
      .select("membro_id")
      .eq("id", userId)
      .maybeSingle();

    await supabase.from("app_push_tokens").upsert(
      {
        token,
        user_id: userId,
        membro_id: prof?.membro_id ?? null,
        platform: Platform.OS,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "token" }
    );

    return token;
  } catch (e) {
    console.log("[push] falha ao registrar:", e);
    return null;
  }
}

/**
 * Remove o push token deste dispositivo de `app_push_tokens`. Chamar ANTES do
 * supabase.auth.signOut() (a RLS de delete exige a sessão do dono). Sem isso o
 * token fica órfão e o ex-usuário (ou a conta excluída) continuaria recebendo
 * pushes destinados à conta antiga neste aparelho. Best-effort: nunca lança.
 */
export async function unregisterPush(): Promise<void> {
  try {
    const projectId =
      (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)
        ?.eas?.projectId ?? (Constants as { easConfig?: { projectId?: string } }).easConfig?.projectId;
    if (!projectId) return;
    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
    if (tokenData?.data) {
      await supabase.from("app_push_tokens").delete().eq("token", tokenData.data);
    }
  } catch (e) {
    console.log("[push] falha ao desregistrar:", e);
  }
}
