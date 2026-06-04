import { router } from "expo-router";
import * as Notifications from "expo-notifications";

/**
 * Roteia o tap em uma push (foreground ou background) pra tela certa,
 * baseado em data.tipo. Use uma vez no _layout raiz.
 */
export function attachNotifTapListener(): () => void {
  function go(data: Notifications.NotificationContent["data"]) {
    if (!data || typeof data !== "object") return;
    const tipo = (data as { tipo?: string }).tipo;
    switch (tipo) {
      case "escala":
        router.navigate("/voluntariado");
        return;
      case "sos": {
        const id = (data as { inscricao_id?: string }).inscricao_id;
        router.navigate(id ? { pathname: "/cuidados", params: { sos: id } } : "/cuidados");
        return;
      }
      case "grupo_pedido": {
        const grupoId = (data as { grupo_id?: string }).grupo_id;
        if (grupoId) router.navigate({ pathname: "/grupo-detalhe", params: { id: grupoId } });
        else router.navigate("/grupos");
        return;
      }
      default:
        router.navigate("/notificacoes");
    }
  }

  // Tap em foreground/background -> abriu o app a partir da notif.
  const subResp = Notifications.addNotificationResponseReceivedListener((resp) => {
    go(resp.notification.request.content.data);
  });

  // Caso o app tenha sido aberto **frio** vindo de uma notif.
  Notifications.getLastNotificationResponseAsync().then((resp) => {
    if (resp) go(resp.notification.request.content.data);
  });

  return () => {
    subResp.remove();
  };
}
