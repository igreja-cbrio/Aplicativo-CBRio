import { apiGet } from './api';
import type { SaudeForm } from './apresentacaoCrianca';
export type FilhoInscricao = { chave: string; nome: string; data_nascimento: string | null };
export type FilhoDetalhe = FilhoInscricao & { sexo: 'M' | 'F' | null; saude: SaudeForm; batismo: {
  nome_completo: string; data_nascimento: string | null; sexo: 'M' | 'F' | null; cpf: string | null; telefone: string | null; email: string | null;
} };
export type FilhosInscricao = { filhos: FilhoInscricao[]; responsavel: { nome: string; telefone: string; email: string } };
export const listarFilhosInscricao = () => apiGet<FilhosInscricao>('/app/kids/inscricoes/filhos');
export const detalheFilhoInscricao = (chave: string) => apiGet<FilhoDetalhe>(`/app/kids/inscricoes/filhos/${encodeURIComponent(chave)}`);
export const nascimentoBR = (v: string | null) => v ? v.split('-').reverse().join('/') : '';
