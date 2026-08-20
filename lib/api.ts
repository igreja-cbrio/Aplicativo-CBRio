// Cliente HTTP da API CBRio (cbrio.org/api).
//
// Cuida de:
//  - base URL fixa
//  - JWT do Supabase no header Authorization (membro logado)
//  - parse de erro JSON em mensagem amigável
//
// Use api.get / api.post sempre que precisar falar com o backend.

import { supabase } from "./supabase";
import type { Marcadores } from "./marcadoresJornada";

// Usar `www.` direto: cbrio.org -> www.cbrio.org redireciona 307 e
// alguns clients dropam o header Authorization na hora de seguir.
const BASE = "https://www.cbrio.org/api";

async function authHeaders(): Promise<Record<string, string>> {
  let {
    data: { session },
  } = await supabase.auth.getSession();
  // Renova proativamente se o token expirou (ou expira em <60s). O backend
  // valida o JWT via getUser; um access_token vencido vira 401 "Token inválido"
  // (sintoma: telas que batem no backend — Kids, Avisos, Meu grupo — quebram,
  // enquanto as que usam o supabase direto seguem funcionando). O auto-refresh
  // pode não ter rodado se o app ficou em background, então forçamos aqui.
  const expMs = session?.expires_at ? session.expires_at * 1000 : 0;
  if (session && expMs && expMs < Date.now() + 60_000) {
    const { data, error } = await supabase.auth.refreshSession();
    if (!error && data.session) {
      session = data.session;
    } else if (expMs < Date.now()) {
      // Token JÁ vencido e o refresh falhou (sem rede / servidor fora): a
      // chamada morreria num 401 "Token inválido" enganoso. Erro honesto —
      // é conexão, não sessão; resolve sozinho quando a rede voltar.
      throw new Error("Não foi possível conectar. Verifique sua internet e tente novamente.");
    }
  }
  const token = session?.access_token;
  if (!token) throw new Error("Sessão expirada. Faça login novamente.");
  return { Authorization: `Bearer ${token}` };
}

// ── Versão mínima do app (Onda 3 · 07/08/2026) ──────────────────────────────
// ⚠️ Rota PÚBLICA (`auth:false`) de propósito: um app abaixo do piso pode nem
// ter conseguido logar (o login é Supabase Auth, fora do Express) — exigir
// sessão faria o aviso não alcançar quem mais precisa dele.
// ⚠️ FAIL-OPEN no chamador: qualquer falha aqui NÃO pode bloquear ninguém.
export type VersaoMinima = {
  bloqueia: boolean;
  minima_ios: string | null;
  minima_android: string | null;
  mensagem: string | null;
  url_loja_ios: string | null;
  url_loja_android: string | null;
};

export function versaoMinimaApp(): Promise<VersaoMinima> {
  return apiGet<VersaoMinima>("/app/versao", { auth: false });
}

async function parseErro(resp: Response): Promise<string> {
  try {
    const j = await resp.json();
    return (j.error || j.message || `Erro ${resp.status}`) as string;
  } catch {
    return `Erro ${resp.status}`;
  }
}

export async function apiGet<T>(path: string, opts?: { auth?: boolean }): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (opts?.auth !== false) Object.assign(headers, await authHeaders());
  const resp = await fetch(`${BASE}${path}`, { headers });
  if (!resp.ok) {
    // ⚠️ `apiGet` era o ÚNICO dos quatro verbos que lançava SEM o status
    // (post/patch/put/delete já anexavam) — quem quisesse distinguir 401 de 429
    // de 500 numa leitura só tinha a string da mensagem pra olhar.
    const err = new Error(await parseErro(resp)) as Error & { status?: number };
    err.status = resp.status;
    throw err;
  }
  return resp.json();
}

export async function apiPost<T>(
  path: string,
  body: unknown,
  opts?: { auth?: boolean }
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (opts?.auth !== false) Object.assign(headers, await authHeaders());
  const resp = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    const err = new Error(await parseErro(resp)) as Error & { status?: number };
    err.status = resp.status;
    throw err;
  }
  return resp.json().catch(() => ({}) as T);
}

export async function apiPatch<T>(path: string, body: unknown): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json", Accept: "application/json", ...(await authHeaders()) };
  const resp = await fetch(`${BASE}${path}`, { method: "PATCH", headers, body: JSON.stringify(body) });
  if (!resp.ok) {
    const err = new Error(await parseErro(resp)) as Error & { status?: number };
    err.status = resp.status;
    throw err;
  }
  return resp.json().catch(() => ({}) as T);
}

/** PUT — mesmo desenho do apiPatch (o app não tinha; a rota de função de
 *  participante de grupo é PUT no backend, espelhando a do web). */
export async function apiPut<T>(path: string, body: unknown): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json", Accept: "application/json", ...(await authHeaders()) };
  const resp = await fetch(`${BASE}${path}`, { method: "PUT", headers, body: JSON.stringify(body) });
  if (!resp.ok) {
    const err = new Error(await parseErro(resp)) as Error & { status?: number };
    err.status = resp.status;
    throw err;
  }
  return resp.json().catch(() => ({}) as T);
}

/**
 * POST multipart de UM arquivo (o app não tinha nenhum — todo upload até aqui
 * ia direto pro Storage, que é justamente o caminho que a capa do grupo não
 * consegue usar).
 *
 * ⚠️⚠️ NÃO SETAR `Content-Type` À MÃO. O React Native precisa gerar o
 * `multipart/form-data; boundary=…` sozinho; fixar o header sem o boundary faz
 * o multer não achar campo nenhum e o servidor responder "Nenhuma imagem foi
 * enviada" com o arquivo tendo subido inteiro. Por isso este helper monta os
 * headers do zero em vez de reusar os do `apiPost`.
 *
 * ⚠️ O `arquivo` é o formato de arquivo do RN (`{ uri, name, type }`), não um
 * `Blob`: no Android a URI é `content://…` e ler os bytes pra montar Blob
 * duplicaria a imagem na memória sem necessidade.
 */
export async function apiUpload<T>(
  path: string,
  campo: string,
  arquivo: { uri: string; name: string; type: string },
): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json", ...(await authHeaders()) };
  const form = new FormData();
  form.append(campo, arquivo as unknown as Blob);
  const resp = await fetch(`${BASE}${path}`, { method: "POST", headers, body: form });
  if (!resp.ok) {
    const err = new Error(await parseErro(resp)) as Error & { status?: number };
    err.status = resp.status;
    throw err;
  }
  return resp.json().catch(() => ({}) as T);
}

export async function apiDelete<T>(path: string): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json", ...(await authHeaders()) };
  const resp = await fetch(`${BASE}${path}`, { method: "DELETE", headers });
  if (!resp.ok) {
    const err = new Error(await parseErro(resp)) as Error & { status?: number };
    err.status = resp.status;
    throw err;
  }
  return resp.json().catch(() => ({}) as T);
}

// ===== Supervisor de área · montar escala pelo app =====
export type SupervisorInfo = { supervisor: boolean; areas: string[] };
export type EscalaServico = { id: string; service_type_name: string | null; scheduled_at: string | null; escalados?: number };
export type EscalaItem = {
  id: string;
  volunteer_id: string | null;
  volunteer_name: string;
  team_name: string | null;
  position_name: string | null;
  confirmation_status: string | null;
  recusa_motivo?: string | null;
};
export type EscalaResposta = { escalas: EscalaItem[]; equipes: string[] };
export type PoolVoluntario = { id: string; full_name: string; planning_center_id: string | null };

export function getSupervisorInfo() {
  return apiGet<SupervisorInfo>("/app/voluntariado/supervisor");
}
export function getEscalaServicos() {
  return apiGet<{ areas: string[]; servicos: EscalaServico[] }>("/app/voluntariado/escala/servicos");
}
export function getEscala(serviceId: string) {
  return apiGet<EscalaResposta>(`/app/voluntariado/escala/${serviceId}`);
}
export function buscarEscalaPool(q: string) {
  return apiGet<PoolVoluntario[]>(`/app/voluntariado/escala-pool?q=${encodeURIComponent(q)}`);
}
export function adicionarNaEscala(body: { service_id: string; volunteer_id: string; team_name?: string; position_name?: string }) {
  return apiPost<EscalaItem>("/app/voluntariado/escala", body);
}
export function removerDaEscala(id: string) {
  return apiDelete<{ ok: boolean }>(`/app/voluntariado/escala/${id}`);
}
export function moverNaEscala(id: string, team_name: string | null) {
  return apiPatch<EscalaItem>(`/app/voluntariado/escala/${id}`, { team_name });
}
export type VoluntarioDetalhe = {
  id: string;
  full_name: string;
  avatar_url: string | null;
  telefone: string | null;
  equipes: string[];
  total_checkins: number;
  total_escalas: number;
  checkins: { culto: string | null; data: string | null }[];
  escalas: { culto: string | null; data: string | null; equipe: string | null; posicao: string | null; status: string | null }[];
};
export function getVoluntarioDetalhe(volProfileId: string) {
  return apiGet<VoluntarioDetalhe>(`/app/voluntariado/voluntario/${volProfileId}/detalhe`);
}

// ===== Tipos do form de voluntariado =====
export type VoluntariadoOpcao = {
  label: string;
  area_canonica: string;
  exige_dados_menor: boolean;
  aviso_titulo: string | null;
  aviso_texto: string | null;
};

export async function getVoluntariadoOpcoes(): Promise<VoluntariadoOpcao[]> {
  // Tolera diferentes formatos: array puro, { opcoes: [...] }, { data: [...] }.
  const raw = await apiGet<unknown>("/public/voluntariado/form-opcoes", { auth: false });
  if (Array.isArray(raw)) return raw as VoluntariadoOpcao[];
  if (raw && typeof raw === "object") {
    const obj = raw as { opcoes?: unknown; data?: unknown };
    if (Array.isArray(obj.opcoes)) return obj.opcoes as VoluntariadoOpcao[];
    if (Array.isArray(obj.data)) return obj.data as VoluntariadoOpcao[];
  }
  return [];
}

// ===== POST /app/inscricoes (genérico, todos os tipos) =====
export type InscricaoVoluntariado = {
  tipo: "voluntariado";
  nome: string;
  sobrenome: string;
  nome_completo: string;
  email: string;
  telefone: string;
  cpf: string;
  nome_mae: string | null;
  areas: string[];
  membro_id: string | null;
};

export type InscricaoGrupo = {
  tipo: "grupos";
  grupo_id: string;
  membro_id: string;
  nome: string;
  telefone: string;
  email: string;
};

// ===== Descoberta pública de grupos (mesma fonte do formulário do site) =====
// Endpoint público /api/public/grupos/buscar — traz os campos ricos (código,
// recorrência, faixa etária, líder) que o Supabase direto não junta. Permite
// os mesmos filtros do formulário público.
export type GrupoPublico = {
  id: string;
  codigo: string | null;
  nome: string;
  categoria: string | null;
  faixa_etaria: string | null;
  dia_semana: number | null;
  horario: string | null;
  recorrencia: string | null;
  local: string | null;
  descricao: string | null;
  bairro: string | null;
  lat: number | null;
  lng: number | null;
  lider_id: string | null;
  lider_nome: string | null;
  lider_foto: string | null;
  status_temporada: string | null;
  temporada: string | null;
  foto_url: string | null;
  dist_km?: number;
};

export function buscarGruposPublico(): Promise<GrupoPublico[]> {
  return apiGet<GrupoPublico[]>("/public/grupos/buscar", { auth: false });
}

export type InscricaoQualquer = InscricaoVoluntariado | InscricaoGrupo | (Record<string, unknown> & { tipo: string });

export function criarInscricaoApi(body: InscricaoQualquer): Promise<{ ok: boolean; message?: string }> {
  return apiPost<{ ok: boolean; message?: string }>("/app/inscricoes", body);
}

import { normalizarVoluntariadoMe } from "./voluntariadoMe";

// ===== /app/voluntariado/me (fonte da verdade do status do voluntário) =====
export type VoluntariadoStatus = "inscrito" | "enviado_ministerio" | "integrado" | string;

export type VoluntariadoMe = {
  inscricao: {
    id: string;
    status: VoluntariadoStatus;
    area: string | null;
    ministerios_interesse: string[] | null;
    integrado_em: string | null;
  } | null;
  voluntario_ativo: boolean;
  escalas?: Array<{
    id: string;
    data: string;
    papel: string | null;
    confirmado: boolean | null;
    ministerio: string | null;
  }>;
};

export async function getVoluntariadoMe(): Promise<VoluntariadoMe> {
  // ⚠️ O `as VoluntariadoMe` que morava aqui era um CAST: `voluntario_ativo`
  // ausente chegava `undefined` e a tela de Servir mandava quem serve pro
  // formulário. A conferência vive em `lib/voluntariadoMe.ts` (pura, no portão).
  return normalizarVoluntariadoMe(await apiGet<unknown>("/app/voluntariado/me"));
}

// ===== /app/grupos/* (líder/supervisor aprova inscrições do grupo) =====
export type GrupoPapel = {
  lider: boolean;
  supervisor: boolean;
  admin_grupos: boolean;
  grupos_liderados: { id: string; nome: string }[];
  grupos_supervisionados: { id: string; nome: string }[];
};

export type GrupoPedido = {
  id: string;
  grupo_id: string;
  grupo_nome: string;
  nome: string;
  telefone: string | null;
  email: string | null;
  origem: string | null;
  created_at: string;
};

export function getGrupoPapel(): Promise<GrupoPapel> {
  return apiGet<GrupoPapel>("/app/grupos/papel");
}

export function listarPedidosGrupo(): Promise<{ admin: boolean; pedidos: GrupoPedido[] }> {
  return apiGet<{ admin: boolean; pedidos: GrupoPedido[] }>("/app/grupos/pedidos");
}

/* ─────────────────────────────────────────────────────────────────────────
 * ⚠️⚠️ ESCRITAS QUE SAÍRAM DO SUPABASE DIRETO (auditoria 06/08/2026 · Onda 2)
 *
 * A LEI do projeto é "quem decide o que é válido é o BACKEND". Três telas ainda
 * escreviam direto na tabela, e cada uma tinha um estrago próprio:
 *   · perfil       → a RPC `app_salvar_membro` vinculava a conta a um cadastro
 *                    por CPF, telefone OU **nome exato**, sem prova de posse;
 *   · indisponib.  → gravava em `vol_availability`, onde só service_role tem
 *                    policy desde 15/06 — a tabela está VAZIA: nunca funcionou;
 *   · editar grupo → a RLS barra supervisor e o update sem `.select()` voltava
 *                    0 linhas SEM erro, com a tela dizendo "Grupo atualizado".
 * ───────────────────────────────────────────────────────────────────────── */

export type PerfilMembroSalvo = {
  id: string;
  nome: string | null;
  telefone: string | null;
  data_nascimento: string | null;
  cpf: string | null;
  foto_url: string | null;
};

/**
 * Salva a ficha do membro JÁ vinculado à conta.
 * ⚠️ NÃO manda CPF: vincular conta a cadastro é ato de IDENTIDADE e passa só por
 * `/app/identidade/*` (CPF acha o cadastro → código vai pro contato DO CADASTRO
 * → quem prova posse é vinculado). O endpoint nem aceita `cpf` no allowlist.
 */
export async function salvarPerfilMembro(dados: {
  nome?: string | null;
  telefone?: string | null;
  data_nascimento?: string | null;
  endereco?: string | null;
}): Promise<PerfilMembroSalvo> {
  return apiPut<PerfilMembroSalvo>("/app/membro/perfil", dados);
}

export type IndisponibilidadeApi = {
  id: string;
  unavailable_from: string;
  unavailable_to: string;
  reason: string | null;
};

/** Janelas em que o voluntário não pode servir. */
export async function listarIndisponibilidadesApi(): Promise<IndisponibilidadeApi[]> {
  const r = await apiGet<IndisponibilidadeApi[]>("/app/voluntariado/indisponibilidades");
  return Array.isArray(r) ? r : [];
}

export async function adicionarIndisponibilidadeApi(
  inicio: string,
  fim: string,
  motivo: string | null,
): Promise<IndisponibilidadeApi> {
  return apiPost<IndisponibilidadeApi>("/app/voluntariado/indisponibilidade", {
    inicio,
    fim,
    motivo: motivo?.trim() || null,
  });
}

export async function removerIndisponibilidadeApi(id: string): Promise<void> {
  await apiDelete(`/app/voluntariado/indisponibilidade/${encodeURIComponent(id)}`);
}

export type GrupoEditavel = {
  id: string;
  nome: string;
  categoria: string | null;
  descricao: string | null;
  tema: string | null;
  dia_semana: number | null;
  horario: string | null;
  local: string | null;
  endereco: string | null;
  bairro: string | null;
};

/**
 * Edita o grupo. É PATCH: só vai o que mudou, e o servidor tem allowlist —
 * `lider_id`, `ativo`, `temporada` e `aceitando_inscricoes` NÃO são editáveis
 * por aqui (o PUT do web é update de objeto inteiro e apagaria esses campos).
 * O servidor devolve 409 se nenhuma linha for afetada, em vez de fingir sucesso.
 */
/** O que a tela pode mandar. Aceita `null` de propósito: campo esvaziado é
 *  "limpar" (e `nome` vazio o servidor recusa com 400, que é o certo). */
export type GrupoEdicaoPatch = {
  nome?: string | null;
  categoria?: string | null;
  descricao?: string | null;
  tema?: string | null;
  dia_semana?: number | null;
  horario?: string | null;
  local?: string | null;
  endereco?: string | null;
  bairro?: string | null;
};

export async function editarGrupo(
  grupoId: string,
  campos: GrupoEdicaoPatch,
): Promise<GrupoEditavel> {
  const r = await apiPut<{ ok: boolean; grupo: GrupoEditavel }>(
    `/app/grupos/${encodeURIComponent(grupoId)}`,
    campos,
  );
  return r.grupo;
}

/**
 * Capa do grupo · SAI PELO BACKEND (07/08/2026 · fecho da Onda 2).
 *
 * ⚠️ O caminho antigo (`supabase.storage.upload` + UPDATE direto em
 * `mem_grupos`) nunca gravou NADA: 0 de 278 linhas com `foto_url` e 0 objetos
 * no bucket. Eram dois defeitos empilhados — a policy do bucket exigindo
 * `is_admin_or_diretor()`, e o UPDATE sem `.select()` que dizia "Capa
 * atualizada." com 0 linhas afetadas. Ver `backend/routes/app.js`.
 *
 * ⚠️ Quem manda na `foto_url` final é o SERVIDOR (ele decide o caminho e a
 * extensão) — a tela aplica o que voltar, nunca o que ela mesma montou.
 */
export async function enviarCapaGrupo(
  grupoId: string,
  arquivo: { uri: string; name: string; type: string },
): Promise<string | null> {
  const r = await apiUpload<{ ok: boolean; foto_url: string | null }>(
    `/app/grupos/${encodeURIComponent(grupoId)}/foto`,
    "foto",
    arquivo,
  );
  return r?.foto_url ?? null;
}

/**
 * Foto de PERFIL · sai pelo backend (10/08/2026 · Onda B).
 *
 * ⚠️ O caminho antigo (`fetch(asset.uri)` + `.arrayBuffer()` + upload direto)
 * nunca chegava ao Storage no Android, onde a URI do ImagePicker é
 * `content://…`. Medido: 18 de 121 profiles têm foto — o caminho de GRAVAÇÃO
 * funciona; era o UPLOAD que falhava.
 * ⚠️ Quem decide a URL final é o SERVIDOR (caminho único por upload).
 */
export async function enviarFotoPerfil(
  arquivo: { uri: string; name: string; type: string },
): Promise<string | null> {
  const r = await apiUpload<{ ok: boolean; avatar_url: string | null }>(
    "/app/membro/foto", "foto", arquivo,
  );
  return r?.avatar_url ?? null;
}

/** Tira a capa do grupo (o app só sabia SUBSTITUIR — foto errada não tinha desfazer). */
export async function removerCapaGrupo(grupoId: string): Promise<void> {
  await apiDelete<{ ok: boolean }>(`/app/grupos/${encodeURIComponent(grupoId)}/foto`);
}

export async function contarPedidosGrupo(): Promise<number> {
  const r = await apiGet<{ count: number }>("/app/grupos/pedidos/count");
  return r?.count ?? 0;
}

export function aprovarPedidoGrupo(id: string): Promise<{ ok: boolean }> {
  return apiPost<{ ok: boolean }>(`/app/grupos/pedidos/${encodeURIComponent(id)}/aprovar`, {});
}

export function recusarPedidoGrupo(id: string, motivo: string): Promise<{ ok: boolean }> {
  return apiPost<{ ok: boolean }>(`/app/grupos/pedidos/${encodeURIComponent(id)}/rejeitar`, { motivo });
}

// ===== Grupos · GERENCIAR (tudo do líder num lugar só · 05/08/2026) =====
// Pedido do Marcos: "ao apertar gerenciar grupo, ali devem ter TODAS as opções
// para se fazer em um grupo". Os endpoints ficam em routes/app.js e reusam os
// escritores canônicos do ERP (RPC de encontro, aprovarPedidoCore).

/**
 * Funções que o APP pode dar. ⚠️⚠️ DUAS COISAS DIFERENTES (corrigido 05/08 por
 * esclarecimento do Marcos — eu tinha confundido as duas):
 *
 *  · `funcao='lider'` no roster é **CADASTRO**: registra que a pessoa lidera
 *    junto. Pode haver vários, e nenhum recebe mensagem por isso.
 *  · `mem_grupos.lider_id` é a **LÍDER PRINCIPAL**: é ela que recebe o WhatsApp
 *    do grupo (lei de 31/07, um destinatário só) e **não pode se remover**.
 *
 * Palavras dele: "só o líder principal recebe mensagem e ele não pode remover a
 * si mesmo, os outros seria apenas para sabermos no cadastro, mas não receberia
 * mensagem nenhum". Por isso `lider` ENTRA aqui, e quem segue protegido é a
 * PESSOA que é `lider_id` (o servidor recusa mudar função/saída dela).
 * ⚠️ `supervisor` e `coordenador` seguem fora: são papéis da hierarquia de
 * supervisão, não do roster do grupo.
 */
export const FUNCOES_QUE_O_APP_DA = ["frequentador", "lider_treinamento", "co_lider", "lider"] as const;
export type FuncaoApp = (typeof FUNCOES_QUE_O_APP_DA)[number];

export function mudarFuncaoMembroGrupo(grupoId: string, rowId: string, funcao: FuncaoApp) {
  return apiPut<{ ok: boolean; funcao: string }>(
    `/app/grupos/${grupoId}/membros/${rowId}/funcao`, { funcao }
  );
}

export function registrarSaidaGrupo(grupoId: string, rowId: string, motivo?: string) {
  return apiPost<{ ok: boolean }>(
    `/app/grupos/${grupoId}/membros/${rowId}/sair`, { motivo: motivo || "" }
  );
}

/** ⚠️ Transferir NÃO põe a pessoa no outro grupo: cria um PEDIDO pro líder de lá
 *  aprovar. A saída do grupo atual é um passo separado (o líder decide). */
export function transferirMembroGrupo(grupoId: string, rowId: string, destinoGrupoId: string) {
  return apiPost<{ ok: boolean; destino?: string; ja_no_destino?: boolean; ja_pedido?: boolean }>(
    `/app/grupos/${grupoId}/membros/${rowId}/transferir`, { destino_grupo_id: destinoGrupoId }
  );
}

export type GrupoEncontro = {
  id: string;
  data: string;
  tema: string | null;
  observacoes: string | null;
  registrado_por_nome: string | null;
  presentes: number;
};

export function getEncontrosGrupo(grupoId: string): Promise<{ encontros: GrupoEncontro[] }> {
  return apiGet<{ encontros: GrupoEncontro[] }>(`/app/grupos/${grupoId}/encontros`);
}

/**
 * A AGENDA do grupo até o fim da temporada (recorrência + exceções).
 *
 * ⚠️ Nenhuma destas datas é linha no banco: o encontro é DERIVADO de
 * `dia_semana` + `horario` + `recorrencia`. O que se guarda é a EXCEÇÃO
 * (remarcado/cancelado). O app não recalcula nada — inclusive a JANELA de
 * remarcação (`remarcar_de`/`remarcar_ate`) vem pronta, pra não existirem duas
 * réguas discordando sobre o que pode.
 */
export type OcorrenciaAgenda = {
  data_original: string;
  data: string;
  horario: string;
  inicio: string;
  status: "normal" | "cancelado" | "remarcado";
  motivo: string | null;
  dia_semana: number;
  pode_remarcar: boolean;
  remarcar_de: string | null;
  remarcar_ate: string | null;
  ancora_incerta: boolean;
};

/**
 * A PRÓPRIA pessoa sai do grupo (pedido da Naná · 18/08).
 *
 * ⚠️ Não é o mesmo endpoint do líder registrando a saída de um participante —
 * aquele exige gate de gestão. Este é a pessoa saindo de si mesma.
 * O servidor recusa (409) se ela liderar ou co-liderar o grupo.
 */
export function sairDoGrupo(grupoId: string, motivo?: string): Promise<{ ok: boolean; saiu: number }> {
  return apiPost(`/app/meu-grupo/${grupoId}/sair`, motivo ? { motivo } : {});
}

export function getAgendaGrupo(grupoId: string): Promise<{
  grupo?: { id: string; nome: string; dia_semana: number | null; horario: string | null; recorrencia?: string };
  ocorrencias: OcorrenciaAgenda[];
  /** O encontro ANTERIOR (mais recente até hoje) já com a exceção aplicada.
   *  `null` = não há, ou foi cancelado (sem pendência de chamada). */
  anterior?: { data_original: string; data: string; status: string } | null;
  aviso?: string;
}> {
  return apiGet(`/app/grupos/${grupoId}/agenda`);
}

/**
 * O encontro ABERTO: quem esteve presente, com NOME.
 *
 * ⚠️ Sob demanda (ao tocar no card), não na lista: seriam 24 encontros × N
 * pessoas a cada abertura de tela.
 * ⚠️ `presentes` só tem quem ESTEVE — a RPC não cria linha pra ausente, então
 * a tela não pode listar faltosos sem inventá-los a partir do roster de HOJE.
 */
// ⚠️ `Omit` porque na LISTA `presentes` é a CONTAGEM e aqui é a lista de gente —
// mesmo nome, tipos diferentes. Estender direto não compila, e é bom que não:
// são duas respostas distintas do servidor.
export type GrupoEncontroDetalhe = Omit<GrupoEncontro, "presentes"> & {
  presentes: { membro_id: string | null; nome: string }[];
};

export function getEncontroDetalhe(grupoId: string, encontroId: string) {
  return apiGet<{ encontro: GrupoEncontroDetalhe }>(
    `/app/grupos/${encodeURIComponent(grupoId)}/encontros/${encodeURIComponent(encontroId)}`
  );
}

/** Registra a frequência do encontro. `presentes` = ids de MEMBRO (não da linha
 *  do roster) — o servidor confere contra o roster ativo. */
export function registrarEncontroGrupo(
  grupoId: string,
  body: { data?: string; tema?: string; observacoes?: string; presentes: string[] }
) {
  return apiPost<{ ok: boolean; encontro_id: string; presentes: number }>(
    `/app/grupos/${grupoId}/encontros`, body
  );
}

/** O líder pede ajuda à coordenação. Chega como notificação + push pra quem
 *  cuida de Grupos (não abre "ticket" — não existe fila com resolvido ainda). */
export function pedirAjudaGrupo(grupoId: string, mensagem: string) {
  return apiPost<{ ok: boolean }>(`/app/grupos/${grupoId}/ajuda`, { mensagem });
}

export type GrupoMaterial = {
  id: string;
  nome: string;
  tipo: string | null;
  url: string | null;
  etiquetas: string[];
  estudo_semana: boolean;
  created_at: string;
};

export function getMateriaisGrupo(grupoId: string): Promise<{ materiais: GrupoMaterial[] }> {
  return apiGet<{ materiais: GrupoMaterial[] }>(`/app/grupos/${grupoId}/materiais`);
}

// Grupos que EU gerencio (líder OU supervisor) — com contagens. Faz o app
// "ver os grupos que gerencio" mesmo sem nenhuma inscrição pendente.
export type GrupoMeu = {
  id: string;
  nome: string;
  dia_semana: number | null;
  horario: string | null;
  local: string | null;
  bairro: string | null;
  categoria: string | null;
  aceitando_inscricoes: boolean | null;
  membros_ativos: number;
  pendentes: number;
  /** Papel decidido pelo SERVIDOR — ver `lib/papelGrupo.ts`. */
  papel?: string | null;
};
export function listarMeusGruposLider(): Promise<{ admin: boolean; grupos: GrupoMeu[] }> {
  return apiGet<{ admin: boolean; grupos: GrupoMeu[] }>("/app/grupos/meus");
}

// Detalhe do grupo (líder): roster ativo + inscrições pendentes daquele grupo.
export type GrupoMembro = {
  /** id da LINHA do roster (`mem_grupo_membros.id`) — é o que as ações usam. */
  id: string;
  /** id da PESSOA (`mem_membros.id`) — é o que a chamada de frequência manda. */
  membro_id: string | null;
  nome: string;
  telefone: string | null;
  funcao: string | null;
  entrou_em: string | null;
  presencas: number | null;
  /**
   * Marcadores de jornada (batismo · Next · servir · devocional). Quem decide
   * o que entra aqui é o SERVIDOR — generosidade nunca chega por esta rota.
   * Opcional: servidor antigo não manda, e a tela só deixa de desenhar.
   * Ver `lib/marcadoresJornada.ts`.
   */
  marcadores?: Marcadores | null;
};
export type GrupoRoster = {
  grupo: {
    id: string; nome: string; dia_semana: number | null; horario: string | null;
    local: string | null; endereco: string | null; bairro: string | null;
    descricao: string | null; categoria: string | null; aceitando_inscricoes: boolean | null;
    /** 'temporada' | 'sempre_aberto' | 'fechado' — decide o link de convite (lib/convite.ts). */
    modo_inscricao?: string | null;
    /**
     * ⚠️ A LÍDER PRINCIPAL. `funcao='lider'` no roster é só CADASTRO (pode ter
     * vários, nenhum recebe mensagem por isso); quem recebe o WhatsApp do grupo
     * é ESTA pessoa, e é ela que não pode mudar de função nem sair pelo app.
     */
    lider_id: string | null;
  };
  membros: GrupoMembro[];
  pendentes: GrupoPedido[];
  /**
   * ⚠️ Papel DESTA pessoa NESTE grupo, decidido pelo servidor (07/08/2026):
   * `lider` | `supervisor` | `admin` | `nenhum`. É o que faz a tela de destino
   * RE-CONFERIR em vez de confiar no que veio na navegação (deep link).
   * Ausente em servidor antigo → `lib/papelGrupo.ts` cai na tela completa.
   */
  meu_papel?: string | null;
};
export function getGrupoRoster(id: string): Promise<GrupoRoster> {
  return apiGet<GrupoRoster>(`/app/grupos/${encodeURIComponent(id)}/membros`);
}

// ── Visita de supervisão (07/08/2026) ───────────────────────────────────────
// ⚠️ Endpoint SEPARADO do encontro de propósito: a frequência é do GRUPO (vai
// pro líder) e a visita é do SUPERVISOR. Quando o interruptor "estive presente"
// está desligado, a tela chama SÓ a frequência — é isso que faz o interruptor
// ter efeito no indicador (ver `lib/visitaSupervisao.ts`).
export type VisitaSupervisao = {
  id: string;
  data_visita: string;
  observacao: string | null;
  status: string;
};

export function registrarVisitaGrupo(
  grupoId: string,
  body: { data_visita: string; observacao: string | null }
) {
  return apiPost<{ ok: boolean; visita: VisitaSupervisao }>(
    `/app/grupos/${encodeURIComponent(grupoId)}/visitas`, body
  );
}

export function listarVisitasGrupo(grupoId: string) {
  return apiGet<{ visitas: VisitaSupervisao[] }>(
    `/app/grupos/${encodeURIComponent(grupoId)}/visitas`
  );
}

// ===== /app/next (NEXT) =====
// ⚠️ `id` é um `next_encontros.id` (MODELO VIVO do Next: turma → encontro →
// matrícula → presença). Até 05/08/2026 o backend devolvia `next_eventos.id`, a
// camada aposentada no cutover de turmas — e como os 8 eventos 'agendado' têm
// data máxima 21/06, a lista vinha VAZIA com 2 turmas abertas no sistema. Ver a
// varredura app × ERP no topo deste CLAUDE.md.
export type NextEncontro = {
  id: string;
  data: string;             // ISO date
  titulo: string;           // tema do encontro; sem tema, o nome da turma
  inscrito: boolean;        // tem matrícula na turma do encontro
  check_in_at: string | null;
  pode_checkin_hoje: boolean;
  turma_id?: string;
  turma_nome?: string | null;
  horario?: string | null;
};

export type NextMe = {
  inscrito_next: boolean;
  encontros: NextEncontro[];
  igreja: { lat: number; lng: number; raio_m: number } | null;
};

export async function getNextMe(): Promise<NextMe> {
  const raw = await apiGet<unknown>("/app/next/me");
  const obj = (raw && typeof raw === "object" && "data" in (raw as object))
    ? (raw as { data: unknown }).data
    : raw;
  return obj as NextMe;
}

export type NextInscreverResp = {
  ok: boolean;
  jaInscrito?: boolean;
  evento?: NextEncontro;
};

export function inscreverNext(): Promise<NextInscreverResp> {
  return apiPost<NextInscreverResp>("/app/next/inscrever", {});
}

export type NextCheckinErro = {
  ok: false;
  error: string;
  distancia_m?: number;
  needLocation?: boolean;
  status: number;
};

export type NextCheckinResp =
  | { ok: true; check_in_at: string }
  | NextCheckinErro;

export async function checkinNext(
  eventoId: string,
  lat: number,
  lng: number
): Promise<NextCheckinResp> {
  try {
    const data = await apiPost<{ ok: boolean; check_in_at: string }>(
      `/app/next/encontros/${encodeURIComponent(eventoId)}/checkin`,
      { lat, lng }
    );
    return { ok: true, check_in_at: data.check_in_at };
  } catch (e) {
    const err = e as Error & { status?: number; raw?: unknown };
    // apiPost lança Error com .status; o body veio em .message OU como JSON.
    // O backend devolve { error, distancia_m?, needLocation? } — tenta extrair.
    let body: Record<string, unknown> = {};
    try {
      body = JSON.parse(err.message) as Record<string, unknown>;
    } catch {
      body = { error: err.message };
    }
    return {
      ok: false,
      error: (body.error as string) ?? err.message ?? "Falha no check-in.",
      distancia_m: typeof body.distancia_m === "number" ? body.distancia_m : undefined,
      needLocation: body.needLocation === true,
      status: err.status ?? 500,
    } as NextCheckinErro;
  }
}

// ===== /app/next — RESPONSÁVEL de turma =====
// Espelha o líder de grupo, mas para a turma do Next. O papel vem do membro
// logado: turmas onde next_turmas.responsavel_id = membro.id.
export type NextTurmaResumo = {
  id: string;
  nome: string;
  status: string;
  observacoes?: string | null;
  origem_mes?: string | null;
  created_at?: string | null;
};

export type NextPapel = {
  responsavel: boolean;
  turmas: NextTurmaResumo[];
};

export function getNextPapel(): Promise<NextPapel> {
  return apiGet<NextPapel>("/app/next/papel");
}

export type NextTurmaEncontro = {
  id: string;
  turma_id: string;
  numero: number | null;
  data: string | null;
  tema: string | null;
};

export type NextMatricula = {
  id: string;
  nome: string | null;
  sobrenome: string | null;
  telefone: string | null;
  status: string | null;
  check_in_at: string | null;
};

export type NextPresenca = {
  encontro_id: string;
  matricula_id: string;
  presente: boolean;
};

export type NextTurmaDetalhe = {
  turma: NextTurmaResumo & { responsavel_id?: string | null };
  encontros: NextTurmaEncontro[];
  matriculas: NextMatricula[];
  presencas: NextPresenca[];
};

export function getNextTurma(turmaId: string): Promise<NextTurmaDetalhe> {
  return apiGet<NextTurmaDetalhe>(`/app/next/turmas/${encodeURIComponent(turmaId)}`);
}

export function marcarPresencaNext(
  encontroId: string,
  matriculaId: string,
  presente: boolean
): Promise<{ ok: boolean; presente: boolean }> {
  return apiPost<{ ok: boolean; presente: boolean }>(
    `/app/next/encontros/${encodeURIComponent(encontroId)}/presenca`,
    { matricula_id: matriculaId, presente }
  );
}

// ===== Família · convite de familiar =====
export type FamiliarMembro = {
  id: string;
  nome: string;
  foto_url?: string | null;
  status?: string | null;
  parentesco?: string | null;
};
export type MinhaFamilia = {
  familia: { id: string; nome: string } | null;
  familiares: FamiliarMembro[];
};
export type ConviteFamilia = {
  codigo: string;
  parentesco: string;
  rotulo: string;
  link: string;
  mensagem: string;
  expira_em: string;
};
export type ConviteInfo = { criador_nome: string; parentesco: string; rotulo: string };

// Parentesco que a pessoa escolhe ao convidar (do ponto de vista do CONVIDADO).
export type ParentescoConvite = "filho" | "pai_mae" | "conjuge" | "irmao" | "outro";

export function getMinhaFamilia(): Promise<MinhaFamilia> {
  return apiGet<MinhaFamilia>("/app/familia");
}

export function criarConviteFamilia(parentesco: ParentescoConvite): Promise<ConviteFamilia> {
  return apiPost<ConviteFamilia>("/app/familia/convite", { parentesco });
}

export function infoConviteFamilia(codigo: string): Promise<ConviteInfo> {
  return apiGet<ConviteInfo>(`/app/familia/convite-info?codigo=${encodeURIComponent(codigo)}`);
}

export function aceitarConviteFamilia(codigo: string): Promise<MinhaFamilia & { ok: boolean; familia: { id: string; nome: string } | null }> {
  return apiPost("/app/familia/aceitar", { codigo });
}

export function removerDaFamilia(outroId: string): Promise<MinhaFamilia & { ok: boolean }> {
  return apiDelete(`/app/familia/vinculo/${encodeURIComponent(outroId)}`);
}

// ===== Inscrições · eventos publicados (espinha /inscricoes do sistema) =====
/** Campo EXTRA do form-builder do evento (os padrão vêm do cadastro). */
export type CampoEvento = {
  key: string;
  label: string;
  tipo?: string;          // texto|textarea|email|numero|data|select|escolha|multi|rede_social|imagem
  obrigatorio?: boolean;
  opcoes?: string[];
};

export type EventoAberto = {
  id: string;
  nome: string;
  slug: string;
  descricao: string | null;
  area: string | null;
  tipo: string | null;
  data: string | null;
  hora: string | null;
  local: string | null;
  capa_url: string | null;
  vagas: number | null;
  /** Prazo pra se inscrever (`insc_eventos.inscricoes_encerram_em`, ISO). */
  inscricoes_encerram_em: string | null;
  /** Vagas RESTANTES pela régua canônica do servidor (`fn_insc_vagas`).
   *  ⚠️ null = evento sem limite de vagas OU o servidor não soube dizer — nos
   *  dois casos a tela OMITE a linha, nunca mostra "0". */
  vagas_restantes: number | null;
  tem_sorteio: boolean;
  pago: boolean;
  valor_centavos: number | null;
  /** Teto de parcelas do evento (null = teto da conta do provedor). A escolha
   *  das parcelas continua na página hospedada de pagamento. */
  parcelas_max: number | null;
  /** ⚠️ Cartão cobrado por uma plataforma externa (e-Inscrição). Quando true, o
   *  app NÃO inscreve por dentro: abre o formulário público, que é quem sabe
   *  perguntar Pix × cartão. Quem decide é o servidor — o app só obedece. */
  so_web?: boolean;
  checkout_externo?: { nome: string } | null;
  campos: CampoEvento[];
  msg_sucesso_titulo: string | null;
  msg_sucesso_texto: string | null;
  /** Já tenho inscrição viva neste evento (alimenta o seletor "Meus eventos"). */
  inscrito: boolean;
  /** ⚠️ Inscrito MAS sem pagamento: vaga reservada, lugar NÃO garantido. Vem do
   *  backend de propósito — `inscrito` sozinho fazia a aba dizer "Inscrito" pra
   *  quem só reservou. Opcional porque bundle novo fala com backend antigo. */
  pagamento_pendente?: boolean;
  /** Form público — fallback quando o app não sabe renderizar (campo `imagem`). */
  url: string;
};

export type TextosInscricao = { termos_lgpd: string; aviso_optin: string };

// ===== Links públicos das portas de inscrição (compartilhar) =====
// ⚠️ A URL vem do SERVIDOR, derivada do registro canônico de portas. O app NÃO
// monta link: `/apresentacao-criancas` já ficou meses no ar como link MORTO
// (11/08/2026), e bundle só se conserta por OTA.
export type PortaInscricaoLink = { chave: string; nome: string; url: string };

export function buscarPortasInscricao(): Promise<{ portas: PortaInscricaoLink[] }> {
  return apiGet<{ portas: PortaInscricaoLink[] }>("/app/inscricoes/portas");
}

export function buscarEventosAbertos(): Promise<{
  eventos: EventoAberto[];
  textos?: TextosInscricao;
}> {
  return apiGet<{ eventos: EventoAberto[]; textos?: TextosInscricao }>("/app/eventos");
}

// ===== Minhas inscrições em eventos (espinha /inscricoes) =====
// ⚠️ Estado da inscrição da pessoa vive na tabela `inscricoes` do sistema, que o
// app NÃO lia — então confirmar/cancelar/dar bolsa/marcar pago no web não tinha
// onde aparecer (medido em 05/08/2026). Estes 2 endpoints fecham isso.
export type MinhaInscricaoEvento = {
  id: string;
  status: string;              // confirmada | recebida | cancelada | ...
  criado_em: string;
  numero_sorte: number | null;
  bolsa_tipo: string | null;   // integral | parcial
  valor_cobrado_centavos: number | null;
  respostas: Record<string, unknown>;
  // /i/c/<token> — o MESMO QR que a portaria lê no check-in.
  // ⚠️ NULO enquanto a inscrição não está `confirmada`: vaga reservada não é
  // inscrição, e comprovante de quem não pagou é o que a portaria aceitaria na
  // entrada. Quem decide é o servidor — o app não monta esse link sozinho.
  comprovante_url: string | null;
  // Por que não veio: 'aguardando_pagamento' | 'cancelada' (null = veio).
  comprovante_bloqueado?: string | null;
  pagamento: {
    status: string | null;
    metodo: string | null;
    valor_centavos: number | null;
    pago_em: string | null;
    expira_em: string | null;
    url: string | null;        // página hospedada (Pix/boleto/cartão)
  } | null;
  evento: {
    id: string;
    nome: string;
    slug: string;
    data: string | null;
    hora: string | null;
    local: string | null;
    capa_url: string | null;
    tem_sorteio: boolean;
    pago: boolean;
    checkin_ativo: boolean;
    /** Link público do evento — pro botão de compartilhar. Opcional porque
     *  bundle novo fala com backend antigo (aí o botão simplesmente não aparece). */
    url?: string | null;
  };
};

export function minhasInscricoesEventos(): Promise<{ inscricoes: MinhaInscricaoEvento[] }> {
  return apiGet<{ inscricoes: MinhaInscricaoEvento[] }>("/app/eventos/minhas");
}

/**
 * Resposta REAL de `inscreverEspinha` (conferida no servidor em 05/08/2026 —
 * `respostaCobranca` + os dois `res.status(201)`):
 *   gratuito → { ok, numero_sorte, tem_sorteio, comprovante_token, beneficio }
 *   pago     → { ok, pagamento: TRUE (boolean!), status, public_token,
 *                checkout_url, valor_centavos, expira_em, tem_sorteio }
 *   já inscrito → o mesmo + ja_inscrito: true
 * ⚠️ `pagamento` é BOOLEAN, não objeto — o link se monta do `public_token`
 * (página hospedada, que deixa escolher Pix/boleto/cartão). Eu tinha escrito
 * como objeto e a tela nunca acharia o link.
 */
export type InscricaoEventoResp = {
  ok?: boolean;
  ja_inscrito?: boolean;
  numero_sorte?: number | null;
  tem_sorteio?: boolean;
  comprovante_token?: string | null;
  /** 'integral' = gratuidade autorizada pela liderança · 'parcial' = desconto. */
  beneficio?: string | null;
  pagamento?: boolean;
  status?: string | null;
  public_token?: string | null;
  checkout_url?: string | null;
  valor_centavos?: number | null;
  expira_em?: string | null;
};

/** Página hospedada de pagamento (Pix/boleto/cartão) da resposta acima. */
export function urlPagamentoDaResposta(r: InscricaoEventoResp): string | null {
  if (r.public_token) return `https://www.cbrio.org/pagamento/${r.public_token}`;
  return r.checkout_url || null;
}

/**
 * Inscreve no evento POR DENTRO do app. O corpo é o MESMO do formulário público
 * e o servidor roda a MESMA função (`inscreverEspinha`) — contrato, vaga atômica,
 * consentimento e cobrança idênticos. O app só pré-preenche e renderiza.
 */
export function inscreverEmEvento(
  eventoId: string,
  body: Record<string, unknown>
): Promise<InscricaoEventoResp> {
  return apiPost<InscricaoEventoResp>(`/app/eventos/${eventoId}/inscrever`, body);
}

// ===== Identidade da conta · vincular ao cadastro REAL da pessoa =====
// Contrato de porta aplicado ao app (04/08/2026): o gatilho de auth.users cria
// a pessoa sem matcher e sem exigir campo, então entrar por e-mail deixava
// cadastro fantasma (nome = prefixo do e-mail) e já duplicou gente. Estes são
// os 2 caminhos certos: rápido por CPF (com prova de posse do celular) ou
// formulário completo (que passa pelo matcher canônico do sistema).
export type IdentidadeStatus = {
  vinculado: boolean;
  completo: boolean;
  falta: string[]; // 'nome' | 'telefone' | 'nascimento' | 'cpf' | 'sexo'
  /**
   * ⚠️ O SERVIDOR decide se o CPF é obrigatório — o app nunca decide sozinho
   * (mesma lei do resto: quem define o que é válido é o backend). Desde
   * 05/08/2026 o gate está LIGADO pra todo mundo; só conta de REVISÃO DE LOJA
   * é isenta (o revisor da Apple não tem CPF brasileiro e travaria na tela de
   * cadastro → build recusado). Ausente = trata como true.
   */
  exige_cpf?: boolean;
  /**
   * ⚠️ `false` = ESTA conta do app ainda não confirmou a ficha, então o
   * formulário **não** pré-preenche CPF/nascimento/telefone do cadastro que o
   * vínculo encontrou. Decisão do Marcos (05/08): "mesmo que o sistema ache que
   * alguém é igual, não deve liberar acesso; depois de preencher todos os dados
   * aí sim pode se ter 100% de certeza" — o gatilho de auth liga por e-mail +
   * nome, e dado herdado de um import não é prova de identidade.
   * Ausente/erro = tratar como `false` (na dúvida, a pessoa digita).
   */
  pode_preencher_com_vinculo?: boolean;
  nome?: string | null;
};

export function statusIdentidade(): Promise<IdentidadeStatus> {
  return apiGet<IdentidadeStatus>("/app/identidade/status");
}

export type IdentidadePorCpf = {
  encontrado: boolean;
  pode_confirmar?: boolean;
  // 'sem_email' = cadastro achado, mas sem e-mail pra provar posse ·
  // 'email_compartilhado' = e-mail em 2+ cadastros (família) — não serve de
  // prova · 'sem_canal' = canal de envio indisponível no servidor.
  motivo?: "nao_encontrado" | "sem_email" | "email_compartilhado" | "sem_telefone" | "sem_canal";
  verificacao_id?: string;
  nome_mascarado?: string | null;
  telefone_mascarado?: string | null;
  email_mascarado?: string | null;
  expira_em_min?: number;
  canal?: string;
};

/** CPF IDENTIFICA (não autentica): o código vai pro telefone JÁ CADASTRADO. */
export function identidadePorCpf(cpf: string): Promise<IdentidadePorCpf> {
  return apiPost<IdentidadePorCpf>("/app/identidade/por-cpf", { cpf });
}

export function confirmarCodigoIdentidade(
  verificacaoId: string,
  codigo: string
): Promise<{ ok: boolean; fantasma_fundido?: boolean }> {
  return apiPost("/app/identidade/confirmar", { verificacao_id: verificacaoId, codigo });
}

export function completarCadastroApp(dados: {
  nome_completo: string;
  telefone: string;
  data_nascimento: string;
  email?: string;
  cpf?: string; // opcional na porta (ver comentário em completar-cadastro.tsx)
  // Obrigatório: o backend exige (identidade/completar · exigirSexo: true).
  sexo: "masculino" | "feminino";
}): Promise<{ ok: boolean; criado?: boolean }> {
  return apiPost("/app/identidade/completar", dados);
}
