import type { FilhoDetalhe } from './kidsFilhosInscricao';
import { nascimentoBR } from './kidsFilhosInscricao';
export const formBatismoCrianca = (f: FilhoDetalhe | null, responsavel?: { telefone: string; email: string }) => ({
  nome: f?.nome || '', nascimento: nascimentoBR(f?.data_nascimento || null), sexo: f?.sexo || '', cpf: f?.batismo.cpf || '',
  telefone: f?.batismo.telefone || responsavel?.telefone || '', email: f?.batismo.email || responsavel?.email || '',
  camisa: '', mobilidade: f?.saude.tem_limitacao_fisica ?? null as boolean | null,
  limitacao: f?.saude.limitacao_fisica_qual || '', observacoes: '',
});
