import { destinoNotificacaoComunicado } from "@/lib/comunicadoLink";
import { destinoDevocionalKids } from "@/lib/kidsDevocionalDestino";
import { destinoAvisoKids } from "@/lib/kidsAvisoDestino";
import { destinoCertificadoKids } from "@/lib/kidsCertificadoDestino";
import { destinoNotificacaoBatismo } from "@/lib/batismoFotosDestino";
import { destinoNotificacaoChat } from "@/lib/assistenteChat";
import { router } from "expo-router";
import * as Notifications from "expo-notifications";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { destinoNotificacaoEvento } from "./eventoDestino";
import { trackEvento } from "./telemetria";

/** Última resposta de push que ESTA instalação já tratou (sobrevive a reinício). */
const CHAVE_ULTIMA = "cbrio:notif_tap_ultima";

/**
 * ⚠️ Quando o toque numa push acabou de navegar (24/11/2026). Com o app em
 * segundo plano há mais de 3 min, o toque navegava para o aviso e, meio
 * segundo depois, o `active` disparava o "voltar depois de um tempo fora =
 * Home" (app/(app)/_layout.tsx) e desfazia a navegação. Medido na telemetria
 * de 23 e 24/11: comunicado e fotos do batismo, a resposta do push chega ANTES
 * do `active`. O reset consulta isto e não mexe logo depois de um toque.
 */
let ultimoToqueEm = 0;
export function toqueDeNotificacaoRecente(ms = 10_000, agora = Date.now()): boolean {
  return ultimoToqueEm > 0 && agora - ultimoToqueEm < ms;
}

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
    const { id, date, memo } = chavesDaResposta(resp);
    // ⚠️ RESPOSTA SEM IDENTIFICADOR E SEM DATA NÃO É TOQUE (26/11/2026). No
    // Android, toda partida a frio devolve uma "última resposta" vazia; ela
    // nunca era reconhecida como replay nem persistida, e caía no evento
    // `notif_tap_sem_destino`: 83 eventos falsos no lançamento, todos
    // "(sem tipo)". Toque de verdade sempre traz um dos dois.
    if (!id && !date) return;
    if (processadas.has(memo)) return;

    const data = resp.notification.request.content.data;
    if (!data || typeof data !== "object") return;
    marcarProcessada(resp);
    ultimoToqueEm = Date.now();
    const tipo = (data as { tipo?: string }).tipo;
    switch (tipo) {
      case "chat_assistente":
        router.navigate(destinoNotificacaoChat(data)); return;
      case "kids_devocional":
        router.navigate(destinoDevocionalKids(data)); return;
      case "kids_mural":
        router.navigate(destinoAvisoKids(data)); return;
      // Certificado da apresentação liberado pela equipe (17/11/2026).
      case "kids_certificado_apresentacao":
        router.navigate(destinoCertificadoKids(data)); return;
      case "carta_transferencia_pronta":
        router.navigate("/carta-transferencia");
        return;
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
      // ⚠️ Tipos criados em 07/08 com a tela do supervisor. Sem `case`, eles
      // caíam no default e o toque NÃO NAVEGAVA — o aviso chegava e não levava
      // a lugar nenhum. Destino é a lista de grupos (quem recebe é a
      // coordenação, que gerencia vários; mandar pro grupo exigiria o papel
      // dela naquele grupo, que a push não carrega).
      case "grupo_encontro_registrado":
      case "grupo_visita_registrada":
      // Saída de participante (18/08): o líder cai na lista de grupos dele.
      case "grupo_saida":
        router.navigate("/meu-grupo");
        return;
      // Álbum publicado (24/11/2026) chega com `destino: 'fotos'` + `album_id` e
      // abre a galeria; os lembretes antigos (sem album_id) seguem em /batismo.
      case "batismo":
        router.navigate(destinoNotificacaoBatismo(data));
        return;
      case "culto": {
        const cultoId = (data as { culto_id?: string }).culto_id;
        if (cultoId) router.navigate({ pathname: "/culto-detalhe", params: { id: cultoId } });
        else router.navigate("/");
        return;
      }
      case "next":
        router.navigate("/next");
        return;
      case "devocional":
        router.navigate("/devocional");
        return;
      // Reação a um comentário do mural (25/11/2026).
      case "devocional_mural_reacao":
        router.navigate("/devocional-mural");
        return;
      case "cuidado":
        router.navigate("/cuidados");
        return;
      case "kids_vinculo":
        router.navigate("/kids");
        return;
      // Kids chamando o responsável no culto: leva à área Kids (sem dado clínico).
      case "kids_chamar_responsavel":
        router.navigate("/kids");
        return;
      case "comunicado": {
        router.navigate(destinoNotificacaoComunicado(data));
        return;
      }
      // ⚠️ Nome começa com `inscricao_` de PROPÓSITO: no binário que ainda não
      // recebeu este OTA, o `default` manda pra aba Inscrições (onde o cartão do
      // evento leva ao comprovante) em vez de o toque não fazer nada.
      case "inscricao_evento_checkin": {
        const eventoId = (data as { evento_id?: string }).evento_id;
        if (eventoId) router.navigate({ pathname: "/evento", params: { id: eventoId } });
        else router.navigate("/inscricoes");
        return;
      }
      case "inscricao_evento": {
        router.navigate(destinoNotificacaoEvento(data));
        return;
      }
      default:
        // ⚠️ A Edge Function de confirmação manda `inscricao_<tipo>`
        // (inscricao_grupos, inscricao_batismo, inscricao_retiro…) — nenhum
        // deles casava nos `case` acima e TODOS caíam no default.
        if (typeof tipo === "string" && tipo.startsWith("inscricao_")) {
          router.navigate("/inscricoes");
          return;
        }
        // ⚠️ Antes o default era `router.navigate("/notificacoes")`, e era ele
        // que sequestrava a abertura do app: qualquer push sem destino (o
        // `aniversario`, os `inscricao_*`) jogava a pessoa na lista em vez da
        // Home. Push sem destino agora NÃO navega — o aviso já está no sino,
        // com contador. O evento abaixo existe pra a gente descobrir qual tipo
        // apareceu sem mapa (em vez de o app "adivinhar" uma tela).
        // Não navegou: o "voltar depois de um tempo fora = Home" segue valendo.
        ultimoToqueEm = 0;
        trackEvento("notif_tap_sem_destino", { notification_type: tipo ?? "(sem tipo)" });
        return;
    }
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
