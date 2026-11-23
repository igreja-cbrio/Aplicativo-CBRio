import { describe, expect, it, vi } from 'vitest';
vi.mock('../lib/api', () => ({apiGet:vi.fn()}));
import { formBatismoCrianca } from '../lib/kidsBatismoForm';
import type { FilhoDetalhe } from '../lib/kidsFilhosInscricao';
const filho = {chave:'kids:1',nome:'Criança Exemplo',data_nascimento:'2020-03-10',sexo:'M',saude:{tem_limitacao_fisica:false},batismo:{cpf:'52998224725',telefone:'21999998888',email:'pai@example.test'}} as FilhoDetalhe;
describe('formulário nativo de batismo Kids', () => {
 it('reaproveita a criança e o contato do responsável sem dados da inscrição anterior', () => {
  const primeiro=formBatismoCrianca(filho); primeiro.camisa='P'; primeiro.observacoes='anterior';
  const segundo=formBatismoCrianca({...filho,nome:'Outra Criança',batismo:{...filho.batismo,cpf:null}});
  expect(segundo).toMatchObject({nome:'Outra Criança',cpf:'',camisa:'',observacoes:'',nascimento:'10/03/2020',mobilidade:false});
 });
 it('entrada manual não herda identidade da criança nem do adulto', () => {
  expect(formBatismoCrianca(null,{telefone:'21999998888',email:'pai@example.test'})).toMatchObject({nome:'',cpf:'',nascimento:'',sexo:'',telefone:'21999998888',mobilidade:null});
 });
});
