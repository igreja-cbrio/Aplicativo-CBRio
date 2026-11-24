import { destinoParaNotificacao, TIPOS_SEM_DESTINO } from "@/lib/destinoNotificacao";
import { router } from "expo-router";
import * as Notifications from "expo-notifications";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { trackEvento } from "./telemetria";

/** Última resposta de push que ESTA instalação já tratou (sobrevive a reinício). */
const CHAVE_ULTIMA = "cbrio:notif_tap_ultima";

/**
 * Roteia o tap em uma push (foreground ou background) pra tela certa,
 * baseado em data.tipo. Use uma vez no _layout raiz.
 */
export function attachNotifTapListener(): () => void {
  // Dedup DENTRO desta abertura (o Android entrega o mesmo evento mais de uma
  // vez quando a Activity é recriada).
  const processadas = new Set<string>();
  let ativo = true;
  let recebeuToqueAoVivo = false;

  /**
   * ⚠️⚠️ DEDUP QUE ATRAVESSA ABERTURAS — é isto que resolve o "toda vez que
   * abro o app ele vai pra tela de Notificações" (Marcos, 04/08/2026).
   *
   * `clearLastNotificationResponseAsync()` só limpa uma variável em MEMÓRIA do
   * módulo nativo (`lastNotificationResponseBundle` em NotificationsEmitter.kt).
   * Processo novo = memória nova, e o Android monta a "última resposta" de novo
   * a partir do intent que abriu a Activity — que continua lá. Ou seja: o clear
   * não impede a re-entrega em ABERTURA NOVA, só dentro da mesma sessão. Por
   * isso a marca tem que ser PERSISTIDA.
   *
   * A chave usa `date` (instante da entrega) E `identifier`, e considera replay
   * se QUALQUER um dos dois casar — se um deles não for estável no Android, o
   * outro ainda segura.
   */
  function chavesDaResposta(resp: Notifications.NotificationResponse) {
    const id = resp.notification.request.identifier || "";
    const date = resp.notification.date ? String(resp.notification.date) : "";
    return { id, date, memo: `${date}|${id}` };
  }

  async function ehReplayDeOutraAbertura(resp: Notifications.NotificationResponse) {
    const { id, date } = chavesDaResposta(resp);
    if (!id && !date) return false;
    try {
      const bruto = await AsyncStorage.getItem(CHAVE_ULTIMA);
      if (!bruto) return false;
      const ant = JSON.parse(bruto) as { id?: string; date?: string };
      return (!!id && ant.id === id) || (!!date && ant.date === date);
    } catch {
      return false;
    }
  }

  function marcarProcessada(resp: Notifications.NotificationResponse) {
    const { id, date, memo } = chavesDaResposta(resp);
    processadas.add(memo);
    if (!id && !date) return;
    AsyncStorage.setItem(CHAVE_ULTIMA, JSON.stringify({ id, date })).catch(() => {});
  }

  function go(resp: Notifications.NotificationResponse | null) {
    if (!ativo || !resp) return;
    const { memo } = chavesDaResposta(resp);
    if (processadas.has(memo)) return;

    const data = resp.notification.request.content.data;
    if (!data || typeof data !== "object") return;
    marcarProcessada(resp);
    const tipo = (data as { tipo?: string }).tipo;
    const destino = destinoParaNotificacao(tipo, data as Record<string, unknown>);
    if (destino) {
      router.navigate(destino);
      return;
    }
    // ⚠️ Push sem destino NÃO navega (antes o default mandava pra
    // "/notificacoes" e sequestrava a abertura do app). O aviso já está no
    // sino, com contador. O evento abaixo existe pra a gente descobrir qual
    // tipo apareceu sem mapa (em vez de o app "adivinhar" uma tela). Tipos em
    // TIPOS_SEM_DESTINO são conhecidos e sem tela de propósito: não são falha.
    if (!tipo || !TIPOS_SEM_DESTINO.has(tipo)) {
      trackEvento("notif_tap_sem_destino", { notification_type: tipo ?? "(sem tipo)" });
    }
    return;
  }

  // Tap em foreground/background -> abriu o app a partir da notif.
  const subResp = Notifications.addNotificationResponseReceivedListener((resp) => {
    recebeuToqueAoVivo = true;
    go(resp);
  });

  // Caso o app tenha sido aberto **frio** vindo de uma notif. Consome a
  // resposta (clear, que vale só nesta sessão) e SÓ roteia se não for a mesma
  // resposta que já tratamos numa abertura anterior.
  Notifications.getLastNotificationResponseAsync().then(async (resp) => {
    if (!ativo || !resp) return;
    const replay = await ehReplayDeOutraAbertura(resp);
    if (!ativo || recebeuToqueAoVivo) return;
    if (!replay) go(resp);
    Notifications.clearLastNotificationResponseAsync().catch(() => {});
  }).catch(() => {});

  return () => {
    ativo = false;
    subResp.remove();
  };
}
