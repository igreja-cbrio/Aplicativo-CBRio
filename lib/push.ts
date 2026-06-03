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
