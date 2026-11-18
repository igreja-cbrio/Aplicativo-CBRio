import { describe, expect, it } from 'vitest';
import { DESTINOS_TELA, destinoDaAcao, lerAcaoAssistente, podeConfirmarAcao, type PropostaAssistente } from '../lib/assistenteAcao';

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
  it('abrir_tela: só telas da lista fechada; o único parâmetro é o slug do evento', () => {
    expect(lerAcaoAssistente({ tipo: 'abrir_tela', destino: '/grupos', titulo: 'Ver os grupos' }))
      .toEqual({ tipo: 'abrir_tela', destino: '/grupos', titulo: 'Ver os grupos', resumo: undefined });
    expect(lerAcaoAssistente({ tipo: 'abrir_tela', destino: '/evento', params: { slug: 'ami-camp-2027' } })?.tipo).toBe('abrir_tela');
    // fora da lista, URL externa, tela administrativa
    for (const destino of ['/admin', 'https://exemplo.test', '/grupo-detalhe', '/configuracoes', '']) {
      expect(lerAcaoAssistente({ tipo: 'abrir_tela', destino })).toBeNull();
    }
    // parâmetro que não é o slug, slug inválido, parâmetro em tela que não aceita, evento sem slug
    expect(lerAcaoAssistente({ tipo: 'abrir_tela', destino: '/evento', params: { id: 'x' } })).toBeNull();
    expect(lerAcaoAssistente({ tipo: 'abrir_tela', destino: '/evento', params: { slug: '../admin' } })).toBeNull();
    expect(lerAcaoAssistente({ tipo: 'abrir_tela', destino: '/evento', params: { slug: 'ok', extra: '1' } })).toBeNull();
    expect(lerAcaoAssistente({ tipo: 'abrir_tela', destino: '/grupos', params: { slug: 'x' } })).toBeNull();
    expect(lerAcaoAssistente({ tipo: 'abrir_tela', destino: '/evento' })).toBeNull();
  });
  it('destino do botão: caminho simples ou evento com slug', () => {
    expect(destinoDaAcao({ tipo: 'abrir_formulario', destino: '/inscricao-next' })).toBe('/inscricao-next');
    expect(destinoDaAcao({ tipo: 'abrir_tela', destino: '/voluntariado' })).toBe('/voluntariado');
    expect(destinoDaAcao({ tipo: 'abrir_tela', destino: '/evento', params: { slug: 'ami' } })).toEqual({ pathname: '/evento', params: { slug: 'ami' } });
  });
  it('espelho do ERP: as telas da lista existem no app', async () => {
    const fs = await import('node:fs');
    for (const destino of DESTINOS_TELA) expect(fs.existsSync(`app/(app)${destino}.tsx`), destino).toBe(true);
  });
});

