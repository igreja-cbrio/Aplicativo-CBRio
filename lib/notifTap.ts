import { router } from "expo-router";
import * as Notifications from "expo-notifications";
import { abrirInscricaoEvento } from "./eventos";

/**
 * Roteia o tap em uma push (foreground ou background) pra tela certa,
 * baseado em data.tipo. Use uma vez no _layout raiz.
 */
export function attachNotifTapListener(): () => void {
  // ⚠️ Dedup por identifier: no ANDROID o sistema re-entrega a MESMA resposta
  // de notificação a cada recriação da Activity — inclusive depois de um
  // crash. Sem isto (e sem o clear no cold start, abaixo), o app REABRIA
  // sempre na tela da última push e o usuário ficava preso (caso "preso em
  // Notificações", Xiaomi · Marcos 04/08/2026 — só apagar os dados resolvia).
  const processadas = new Set<string>();

  function go(resp: Notifications.NotificationResponse | null) {
    if (!resp) return;
    const id = resp.notification.request.identifier;
    if (id) {
      if (processadas.has(id)) return;
      processadas.add(id);
    }
    const data = resp.notification.request.content.data;
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
      case "grupo_pedido":
        // Pedido de entrada no grupo → tela do líder aprovar/recusar.
        router.navigate("/grupo-inscricoes");
        return;
      case "batismo":
        router.navigate("/batismo");
        return;
      case "culto": {
        const cultoId = (data as { culto_id?: string }).culto_id;
        if (cultoId) router.navigate({ pathname: "/culto-detalhe", params: { id: cultoId } });
        else router.navigate("/");
        return;
      }
      case "next":
        router.navigate("/");
        return;
      case "devocional":
        router.navigate("/devocional");
        return;
      case "cuidado":
        router.navigate("/cuidados");
        return;
      case "kids_vinculo":
        router.navigate("/kids");
        return;
      case "comunicado":
        router.navigate("/mural");
        return;
      case "inscricao_evento": {
        // Push de evento publicado → abre o formulário público do evento
        // (mesmo fluxo do site · gratuito ou pago→Asaas). Sem slug, cai na aba.
        const slug = (data as { slug?: string }).slug;
        if (slug) abrirInscricaoEvento(slug);
        else router.navigate("/inscricoes");
        return;
      }
      default:
        router.navigate("/notificacoes");
    }
  }

  // Tap em foreground/background -> abriu o app a partir da notif.
  const subResp = Notifications.addNotificationResponseReceivedListener((resp) => {
    go(resp);
  });

  // Caso o app tenha sido aberto **frio** vindo de uma notif. CONSOME a
  // resposta na hora (clear) — senão o Android devolve a mesma resposta em
  // TODA abertura seguinte e o app fica "grudado" na tela da push.
  Notifications.getLastNotificationResponseAsync().then((resp) => {
    if (!resp) return;
    Notifications.clearLastNotificationResponseAsync().catch(() => {});
    go(resp);
  });

  return () => {
    subResp.remove();
  };
}
