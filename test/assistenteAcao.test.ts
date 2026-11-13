import { describe, expect, it } from 'vitest';
import { lerAcaoAssistente, podeConfirmarAcao, type PropostaAssistente } from '../lib/assistenteAcao';

const proposta: PropostaAssistente = { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', tipo: 'batismo', titulo: 'Inscrição',
  resumo: 'Data e pessoa revisadas', termos: 'Termos de consentimento', expira_em: '2026-11-13T18:00:00Z',
  campos: [{ chave: 'tamanho_camisa', rotulo: 'Camisa', tipo: 'opcoes', opcoes: ['P', 'M'], obrigatorio: true }] };
const agora = Date.parse('2026-11-13T17:00:00Z');
describe('ação no chat', () => {
  it('rejeita destinos externos, escrita desconhecida e proposta sem termos válidos', () => {
    expect(lerAcaoAssistente({ tipo: 'abrir_formulario', destino: 'https://exemplo.test' })).toBeNull();
    expect(lerAcaoAssistente({ ...proposta, tipo: 'excluir_membro' })).toBeNull();
    expect(lerAcaoAssistente({ ...proposta, termos: '' })).toBeNull();
    expect(lerAcaoAssistente({ ...proposta, expira_em: 'lixo' })).toBeNull();
    expect(lerAcaoAssistente({ ...proposta, campos: [{ chave: 'cpf', tipo: 'texto' }] })).toBeNull();
    expect(lerAcaoAssistente(proposta)).toEqual(proposta);
  });
  it('exige aceite explícito e campo obrigatório válido antes de confirmar', () => {
    expect(podeConfirmarAcao(proposta, false, { tamanho_camisa: 'M' }, agora)).toBe(false);
    expect(podeConfirmarAcao(proposta, true, {}, agora)).toBe(false);
    expect(podeConfirmarAcao(proposta, true, { tamanho_camisa: 'X' }, agora)).toBe(false);
    expect(podeConfirmarAcao(proposta, true, { tamanho_camisa: 'M' }, agora)).toBe(true);
    expect(podeConfirmarAcao(proposta, true, { tamanho_camisa: 'M' }, Date.parse(proposta.expira_em))).toBe(false);
  });
  it('permite Next sem campos adicionais, mantendo o aceite obrigatório', () => {
    expect(podeConfirmarAcao({ ...proposta, tipo: 'next', campos: [] }, true, {}, agora)).toBe(true);
  });
});
