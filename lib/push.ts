import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { supabase } from "./supabase";
import { trackEvento } from "./telemetria";
import { motivoDaFalhaPush, mensagemDoErro } from "./motivoPush";

/**
 * Registra o dispositivo para receber push e salva o Expo push token em
 * `app_push_tokens` (vinculado ao usuário e ao membro). O backend do sistema
 * dispara o push ao criar uma escala (ver supabase/functions/notify-escala).
 *
 * ⚠️⚠️ ZERO TOKEN NO ANDROID — MEDIDO EM 07/08/2026, E NÃO SE CONSERTA AQUI.
 * `app_push_tokens` tem 30 linhas, **todas iOS**. O projeto nunca teve
 * `android.googleServicesFile` no app.json nem `google-services.json` no repo
 * (`git log --all` volta vazio nos dois), então o binário Android sai sem
 * Firebase e `getExpoPushTokenAsync` falha na primeira linha. O conserto exige
 * projeto Firebase + BUILD Android novo — **não sai por OTA e não sai por
 * merge**. O que sai por OTA é o que está aqui: PARAR DE ENGOLIR o erro.
 *
 * ⚠️ O que NÃO está quebrado no Android: o aviso in-app. `_shared/notify.ts`
 * grava a linha em `app_notificacoes` ANTES de olhar tokens — o sino funciona,
 * o que falta é a INTERRUPÇÃO (a notificação que aparece com o app fechado).
 *
 * Observações:
 * - Push **não funciona no simulador iOS** (o token falha e é classificado
 *   como `simulador`, não como defeito).
 * - Requer um `projectId` do EAS (app.json extra.eas.projectId, via `eas init`).
 */
export async function registerForPush(userId: string): Promise<string | null> {
  // ⚠️ O canal fica FORA do try principal: ele é independente do token, e antes
  // uma falha aqui abortava até o PEDIDO DE PERMISSÃO. O som de push no Android
  // é definido por canal, não pelo payload — então ele precisa existir mesmo
  // que o registro do token falhe depois.
  if (Platform.OS === "android") {
    try {
      await Notifications.setNotificationChannelAsync("default", {
        name: "CBRio",
        importance: Notifications.AndroidImportance.HIGH,
        sound: "cbrio_chime.wav",
        vibrationPattern: [0, 250, 250, 250],
      });
    } catch (e) {
      trackEvento("push_canal_falhou", { message: mensagemDoErro(e) });
    }
  }

  try {
    const { status: existing } = await Notifications.getPermissionsAsync();
    let status = existing;
    if (existing !== "granted") {
      const req = await Notifications.requestPermissionsAsync();
      status = req.status;
    }
    if (status !== "granted") {
      // ⚠️ Isto era um `return null` MUDO. Sem ele, "ninguém tem token" e
      // "ninguém autorizou" ficavam indistinguíveis no painel — e são
      // conclusões opostas: uma é conserto de código, a outra é conversa.
      trackEvento("push_sem_token", { reason: "permissao", permission: String(status) });
      return null;
    }

    const projectId =
      (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)
        ?.eas?.projectId ?? (Constants as { easConfig?: { projectId?: string } }).easConfig?.projectId;
    if (!projectId) {
      trackEvento("push_sem_token", { reason: "sem_project_id" });
      return null;
    }

    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
    const token = tokenData.data;

    const { data: prof } = await supabase
      .from("profiles")
      .select("membro_id")
      .eq("id", userId)
      .maybeSingle();

    const { error } = await supabase.from("app_push_tokens").upsert(
      {
        token,
        user_id: userId,
        membro_id: prof?.membro_id ?? null,
        platform: Platform.OS,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "token" }
    );
    // O token nasceu mas não foi guardado: a pessoa segue sem receber nada, e
    // esse caso era invisível — o `upsert` não lança, devolve `{ error }`.
    if (error) {
      trackEvento("push_sem_token", { reason: "gravacao", message: mensagemDoErro(error) });
      return null;
    }

    trackEvento("push_token_ok", { label: Platform.OS });
    return token;
  } catch (e) {
    // ⚠️⚠️ AQUI ERA SÓ UM `console.log`. Foi este silêncio — e não o Firebase —
    // que deixou o Android sem push por dois meses sem ninguém saber.
    // `reason` e `message` já estão na whitelist do backend
    // (`services/systemMobileOps.js`); não precisa mudar nada no ERP.
    trackEvento("push_sem_token", {
      reason: motivoDaFalhaPush(e),
      message: mensagemDoErro(e),
    });
    return null;
  }
}

/**
 * Remove o push token deste dispositivo de `app_push_tokens`. Chamar ANTES do
 * supabase.auth.signOut() (a RLS de delete exige a sessão do dono). Sem isso o
 * token fica órfão e o ex-usuário (ou a conta excluída) continuaria recebendo
 * pushes destinados à conta antiga neste aparelho. Best-effort: nunca lança.
 *
 * ⚠️ Sem telemetria de propósito: no Android isto lança pelo MESMO motivo do
 * registro (binário sem Firebase), e instrumentar aqui só duplicaria o mesmo
 * evento no logout de toda a frota Android, sem informação nova.
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
