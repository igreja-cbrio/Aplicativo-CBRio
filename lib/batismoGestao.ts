import { apiDelete, apiGet, apiPost, apiPut } from './api';

export type BatismoPapel = {
  pode_gerenciar: boolean;
  nivel: number;
  superadmin: boolean;
};

export type BatismoPessoaGestao = {
  id: string;
  membro_id: string | null;
  nome: string;
  sobrenome: string | null;
  telefone: string | null;
  email: string | null;
  cpf: string | null;
  data_nascimento: string | null;
  data_batismo: string | null;
  horario_culto: string | null;
  status: string;
  checkin_em: string | null;
  tamanho_camisa: string | null;
  eh_crianca: boolean | null;
  possui_deficiencia: boolean | null;
  deficiencia_descricao: string | null;
  observacoes: string | null;
  endereco: string | null;
  area_kpi: string | null;
  created_at: string;
};

export type BatismoHorarioGestao = { horario: string; label: string };

export type BatismoGestao = {
  data: string;
  datas: string[];
  hoje: string;
  pessoas: BatismoPessoaGestao[];
  aprovacoes: BatismoPessoaGestao[];
  resumo: { previstos: number; presentes: number; aguardando: number };
  horarios: BatismoHorarioGestao[];
};

export type BatismoPessoaPayload = Partial<{
  nome: string;
  sobrenome: string;
  telefone: string | null;
  email: string | null;
  cpf: string | null;
  data_nascimento: string | null;
  data_batismo: string;
  horario_culto: string | null;
  tamanho_camisa: string | null;
  observacoes: string | null;
  endereco: string | null;
  area_kpi: string;
  eh_crianca: boolean;
  possui_deficiencia: boolean;
  deficiencia_descricao: string | null;
}>;

export function getBatismoPapel(): Promise<BatismoPapel> {
  return apiGet<BatismoPapel>('/app/batismo/papel');
}

export function getBatismoGestao(data?: string): Promise<BatismoGestao> {
  const query = data ? `?data=${encodeURIComponent(data)}` : '';
  return apiGet<BatismoGestao>(`/app/batismo/gestao${query}`);
}

export function adicionarPessoaBatismo(payload: BatismoPessoaPayload): Promise<BatismoPessoaGestao> {
  return apiPost<BatismoPessoaGestao>('/app/batismo/gestao/pessoas', payload);
}

export function aprovarPessoaBatismo(
  id: string,
  payload: { data_batismo: string; horario_culto?: string | null },
): Promise<BatismoPessoaGestao> {
  return apiPost<BatismoPessoaGestao>(`/app/batismo/gestao/${encodeURIComponent(id)}/aprovar`, payload);
}

export function editarPessoaBatismo(id: string, payload: BatismoPessoaPayload): Promise<BatismoPessoaGestao> {
  return apiPut<BatismoPessoaGestao>(`/app/batismo/gestao/${encodeURIComponent(id)}`, payload);
}

export function checkinPessoaBatismo(id: string, presente: boolean): Promise<BatismoPessoaGestao> {
  return apiPost<BatismoPessoaGestao>(`/app/batismo/gestao/${encodeURIComponent(id)}/checkin`, { presente });
}

export function retirarPessoaBatismo(id: string): Promise<{ ok: boolean; id: string }> {
  return apiDelete<{ ok: boolean; id: string }>(`/app/batismo/gestao/${encodeURIComponent(id)}`);
}
