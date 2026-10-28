import type { CampoEvento, InscricaoEventoResp, TextosInscricao } from "./api";
import { apiGet, apiPost } from "./api";
import type { MembroFicha } from "./ficha";
import { montarPayloadInscricao } from "./inscricaoPayload";

export type EventoPublico = {
  nome: string; slug: string; data?: string; hora?: string; local?: string;
  descricao?: string; form_ativo: boolean; inscricoes_encerradas?: boolean;
  contrato?: string; exigir_endereco?: boolean; exige_dados_menor?: boolean;
  termos_extra?: unknown[]; checkout_externo?: unknown; aviso?: string | null;
  pagamento_ativo?: boolean; valor_centavos?: number;
  msg_sucesso_titulo?: string; msg_sucesso_texto?: string;
  campos: (CampoEvento & { mostrar_se?: unknown })[];
};

function caminho(slug: string) {
  if (!/^[a-zA-Z0-9_-]+$/.test(slug)) throw new Error("Evento não encontrado");
  return `/public/evento/${slug}`;
}

export async function buscarEventoParticipante(slug: string) {
  return Promise.all([
    apiGet<EventoPublico>(caminho(slug), { auth: false }),
    apiGet<TextosInscricao>("/public/evento/textos", { auth: false }),
  ]);
}

/** Somente contratos que estes controles representam por inteiro. Formulários
 * especiais mantêm sua porta canônica, sem perder autorização ou pagamento. */
export function suportaParticipanteNativo(e: EventoPublico) {
  return (!e.contrato || ["completo", "minimo"].includes(e.contrato))
    && !e.exige_dados_menor && !e.termos_extra?.length && !e.checkout_externo
    && (e.campos || []).every(c => !c.mostrar_se &&
      [undefined, "texto", "text", "textarea", "email", "numero", "data", "select", "escolha", "multi", "rede_social"].includes(c.tipo));
}

/** A ficha é um estado vazio da tela, nunca useMembro. Whitelist exclui IDs
 * do titular mesmo se o chamador fornecer propriedades adicionais. */
export function enviarInscricaoParticipante(slug: string, participante: MembroFicha,
  extras: Record<string, string>, aceite: boolean, optin: boolean, endereco: string) {
  if (!aceite) throw new Error("É preciso aceitar os termos para se inscrever.");
  return apiPost<InscricaoEventoResp>(`${caminho(slug)}/inscrever`, {
    ...montarPayloadInscricao(participante, extras, optin),
    endereco: endereco.trim() || null,
  }, { auth: false });
}
