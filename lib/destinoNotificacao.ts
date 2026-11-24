// ════════════════════════════════════════════════════════════════════════════
// O DESTINO DO TOQUE EM UMA NOTIFICAÇÃO (24/11/2026 · "toda notificação tem
// que levar pra rota certa", Matheus).
//
// Até aqui havia DOIS mapas: o da push (lib/notifTap.ts) e o da lista do sino
// (app/(app)/notificacoes.tsx). Eles já divergiram duas vezes (11/08 e 24/11):
// tipo que só um conhecia caía no vazio e o toque não levava a lugar nenhum —
// pra quem toca, é o app "abrindo na home". Um aviso que não abre a tela certa
// é o mesmo que não avisar.
//
// Agora o mapa é UM SÓ, aqui. Os dois pontos de toque chamam
// `destinoParaNotificacao` e navegam se a rota existir:
//   - push (foreground/background/abertura fria): lib/notifTap.ts
//   - lista do sino: app/(app)/notificacoes.tsx
//
// Arquivo PURO (sem módulo nativo), no molde dos `*Destino.ts` que ele reúne.
// Regras que continuam valendo:
//   - Nunca aceita destino livre vindo do push: cada helper valida o que lê
//     (UUID, slug) e cai numa rota segura quando o dado vem ruim.
//   - Tipo sem mapa NÃO navega (retorna null): o aviso já está no sino; a
//     push desconhecida é registrada em telemetria pelo notifTap.
// ════════════════════════════════════════════════════════════════════════════
import type { Href } from "expo-router";
import { destinoNotificacaoComunicado } from "./comunicadoLink";
import { destinoDevocionalKids } from "./kidsDevocionalDestino";
import { destinoAvisoKids } from "./kidsAvisoDestino";
import { destinoCertificadoKids } from "./kidsCertificadoDestino";
import { destinoNotificacaoBatismo } from "./batismoFotosDestino";
import { destinoNotificacaoChat } from "./assistenteChat";
import { destinoNotificacaoEvento } from "./eventoDestino";

/**
 * Tipos conhecidos SEM tela de destino: o toque só abre o app, sem navegar —
 * decisão, não falta de mapa. O notifTap não loga esses como "sem destino".
 */
export const TIPOS_SEM_DESTINO: ReadonlySet<string> = new Set([
  // Parabéns (notify-lembretes): saudação, não aponta para nenhuma tela.
  "aniversario",
]);

export function destinoParaNotificacao(tipo: string | undefined, data: Record<string, unknown>): Href | null {
  switch (tipo) {
    case "chat_assistente":
      return destinoNotificacaoChat(data);
    case "kids_devocional":
      return destinoDevocionalKids(data);
    case "kids_mural":
      return destinoAvisoKids(data);
    case "kids_certificado_apresentacao":
      return destinoCertificadoKids(data);
    case "carta_transferencia_pronta":
      return "/carta-transferencia";
    case "escala":
      return "/voluntariado";
    case "sos": {
      const id = (data as { inscricao_id?: string }).inscricao_id;
      return id ? { pathname: "/cuidados" as const, params: { sos: id } } : "/cuidados";
    }
    case "cuidado":
      return "/cuidados";
    case "grupo_pedido":
      // Pedido de entrada no grupo → tela do líder aprovar/recusar.
      return "/grupo-inscricoes";
    // Avisos da coordenação (07/08) e saída de participante (18/08): quem
    // recebe gerencia vários grupos, então cai na lista dos grupos dele.
    case "grupo_encontro_registrado":
    case "grupo_visita_registrada":
    case "grupo_saida":
      return "/meu-grupo";
    // Álbum publicado (24/11/2026) chega com `destino: 'fotos'` + `album_id` e
    // abre a galeria; os lembretes antigos (sem album_id) seguem em /batismo.
    case "batismo":
      return destinoNotificacaoBatismo(data);
    case "culto": {
      const cultoId = (data as { culto_id?: string }).culto_id;
      return cultoId ? { pathname: "/culto-detalhe" as const, params: { id: cultoId } } : "/";
    }
    case "next":
      return "/next";
    case "devocional":
      return "/devocional";
    case "kids_vinculo":
    // Kids chamando o responsável no culto: leva à área Kids (sem dado clínico).
    case "kids_chamar_responsavel":
      return "/kids";
    case "comunicado":
      return destinoNotificacaoComunicado(data);
    // ⚠️ Nome começa com `inscricao_` de PROPÓSITO: binário sem este mapa cai
    // no prefixo `inscricao_` e abre a aba Inscrições em vez de não fazer nada.
    case "inscricao_evento_checkin": {
      const eventoId = (data as { evento_id?: string }).evento_id;
      return eventoId ? { pathname: "/evento" as const, params: { id: eventoId } } : "/inscricoes";
    }
    case "inscricao_evento":
      return destinoNotificacaoEvento(data);
    // Bug reportado pela pessoa e corrigido pela equipe (ERP · agentTasks).
    // O ERP manda `link: '/assistente-ia'`, tela que NÃO existe no app — o
    // lugar onde ela fala com o assistente/equipe é /fale-conosco-chat.
    case "bug_corrigido":
      return "/fale-conosco-chat";
    default:
      if (tipo && TIPOS_SEM_DESTINO.has(tipo)) return null;
      // ⚠️ A Edge Function de confirmação manda `inscricao_<tipo>`
      // (inscricao_grupos, inscricao_batismo, inscricao_retiro…).
      if (typeof tipo === "string" && tipo.startsWith("inscricao_")) return "/inscricoes";
      return null;
  }
}
