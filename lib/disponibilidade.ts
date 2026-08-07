import { hojeBRT } from "./dataBRT";
import {
  listarIndisponibilidadesApi,
  adicionarIndisponibilidadeApi,
  removerIndisponibilidadeApi,
} from "./api";

/**
 * ⚠️⚠️ ESTA TELA NUNCA GRAVOU NADA EM PRODUÇÃO (auditoria 06/08/2026).
 *
 * Até hoje este arquivo escrevia DIRETO em `vol_availability` pelo supabase-js
 * (anon + RLS). Só que o lockdown de 15/06 (`20260615190000`) dropou a policy
 * aberta e criou `vol_availability_service ... TO service_role` — **não existe
 * policy pra `authenticated` em migration nenhuma**. Sonda em produção
 * (06/08, service_role, `count=exact`): **0 linhas na tabela**. Ou seja, o
 * voluntário marcava as datas em que não pode servir, o app não reclamava, e a
 * escala continuava contando com ele exatamente no dia que ele avisou.
 *
 * O conserto é trocar o caminho, não afrouxar a RLS: os 3 endpoints já existiam
 * no backend (`GET/POST/DELETE /app/voluntariado/indisponibilidade[s]`,
 * `routes/app.js`) e **não tinham um único chamador**. É a LEI do projeto —
 * quem decide o que é válido é o BACKEND.
 *
 * ⚠️ As assinaturas das funções ficaram IGUAIS pra a tela não mudar. O
 * `volProfileId` continua no parâmetro por compatibilidade, mas **não é mais
 * usado**: quem resolve o perfil de voluntário agora é o servidor, pelo token
 * (`vol_profiles.auth_user_id`) — e é bom que seja, porque assim o cliente não
 * decide de quem é a indisponibilidade.
 */

export type Indisponibilidade = {
  id: string;
  unavailable_from: string; // ISO date
  unavailable_to: string; // ISO date
  reason: string | null;
};

/**
 * @deprecated Não é mais necessário: o servidor resolve o perfil de voluntário
 * pelo token. Mantido só porque a tela ainda passa o id adiante; devolve o que
 * recebeu pra não quebrar quem chama.
 *
 * ⚠️ NÃO reintroduzir a busca direta em `vol_profiles`: ela existia aqui e era
 * o começo do caminho que não gravava. Helper morto apontando pra tabela que o
 * app não pode escrever é exatamente como este bug nasceu.
 */
export async function getMeuVolProfileId(
  _authUserId: string,
  membroId: string | null,
): Promise<string | null> {
  return membroId ?? null;
}

/** Janelas de indisponibilidade do voluntário (as atuais e futuras). */
export async function listarIndisponibilidades(
  _volProfileId?: string,
): Promise<Indisponibilidade[]> {
  const todas = await listarIndisponibilidadesApi();
  // ⚠️ Filtro em BRT, não UTC: das 21h do Rio em diante o "hoje" em UTC já virou
  // e a janela que termina HOJE sumiria da lista antes da hora (lib/dataBRT.ts).
  // O endpoint devolve tudo; o recorte de exibição é daqui.
  const hoje = hojeBRT();
  return todas
    .filter((i) => String(i.unavailable_to || i.unavailable_from) >= hoje)
    .sort((a, b) => String(a.unavailable_from).localeCompare(String(b.unavailable_from)));
}

export async function adicionarIndisponibilidade(
  _volProfileId: string,
  from: string,
  to: string,
  reason: string | null,
): Promise<void> {
  // Deixa o erro do servidor SUBIR: a tela precisa poder dizer que não deu.
  // Engolir aqui reproduziria o defeito antigo por outro caminho.
  await adicionarIndisponibilidadeApi(from, to, reason);
}

export async function removerIndisponibilidade(id: string): Promise<void> {
  await removerIndisponibilidadeApi(id);
}
