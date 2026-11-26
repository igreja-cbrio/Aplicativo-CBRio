import { describe, expect, it } from 'vitest';
import { diaCivilAvisos, rotuloDataAviso } from '../lib/dataAvisos';
const t = (texto: string) => texto;
const rotulo = (envio: string | null, agora: string, compacto = true) => rotuloDataAviso(envio, diaCivilAvisos(agora), t, 'pt-BR', compacto);

describe('data dos avisos: dia do calendário, não idade em horas', () => {
  it('aviso enviado ontem à tarde aparece Ontem antes de completar 24 horas', () => {
    expect(rotulo('2026-11-25T16:00:00-03:00', '2026-11-26T09:00:00-03:00')).toBe('Ontem');
  });
  it('um minuto de diferença atravessando meia-noite já é Ontem', () => {
    expect(rotulo('2026-11-25T23:59:00-03:00', '2026-11-26T00:00:00-03:00')).toBe('Ontem');
  });
  it('aviso do mesmo dia permanece Hoje mesmo depois de 23 horas', () => {
    expect(rotulo('2026-11-26T00:01:00-03:00', '2026-11-26T23:59:00-03:00')).toBe('Hoje');
  });
  it('não adianta o dia à noite por causa da data UTC', () => {
    expect(diaCivilAvisos('2026-11-26T01:30:00Z')).toBe('2026-11-25');
    expect(rotulo('2026-11-25T18:00:00Z', '2026-11-26T01:30:00Z')).toBe('Hoje');
    expect(rotulo('2026-11-26T01:30:00Z', '2026-11-26T03:00:00Z')).toBe('Ontem');
  });
  it('conta dois dias civis mesmo com só 25 horas entre os instantes', () => {
    expect(rotulo('2026-11-24T23:30:00-03:00', '2026-11-26T00:30:00-03:00')).toBe('Há 2 dias');
  });
  it.each([
    ['2026-10-31T23:00:00-03:00', '2026-11-01T01:00:00-03:00'],
    ['2026-12-31T23:00:00-03:00', '2027-01-01T01:00:00-03:00'],
    ['2028-02-29T23:00:00-03:00', '2028-03-01T01:00:00-03:00'],
  ])('funciona na virada de mês, ano e fevereiro bissexto (%s)', (envio, agora) => {
    expect(rotulo(envio, agora)).toBe('Ontem');
  });
  it('o mesmo aviso muda de Hoje para Ontem ao atualizar o dia de referência', () => {
    const envio = '2026-11-25T17:00:00-03:00';
    expect(rotuloDataAviso(envio, '2026-11-25', t)).toBe('Hoje');
    expect(rotuloDataAviso(envio, '2026-11-26', t)).toBe('Ontem');
    expect(rotuloDataAviso(envio, '2026-11-27', t)).toBe('Há 2 dias');
  });
  it.each([null, '', 'sem-data'])('não inventa Hoje para data ausente ou inválida (%s)', envio => {
    expect(rotulo(envio, '2026-11-26T12:00:00-03:00')).toBe('');
  });
  it('data futura de outro dia aparece por extenso, nunca Hoje', () => {
    expect(rotulo('2026-11-27T12:00:00-03:00', '2026-11-26T12:00:00-03:00')).toMatch(/27.*nov/);
  });
  it('datas antigas são formatadas no Rio e incluem ano quando necessário', () => {
    expect(rotulo('2026-11-10T01:00:00Z', '2026-11-26T12:00:00Z')).toMatch(/^09.*nov/);
    expect(rotulo('2025-11-10T12:00:00Z', '2026-11-26T12:00:00Z')).toContain('2025');
  });
  it('seções de notificações usam a mesma data, preservando datas por extenso', () => {
    expect(rotulo('2026-11-25T18:00:00Z', '2026-11-26T12:00:00Z', false)).toBe('Ontem');
    expect(rotulo('2026-11-24T18:00:00Z', '2026-11-26T12:00:00Z', false)).toMatch(/24.*novembro/);
  });
  it('respeita o idioma escolhido nos rótulos e datas', () => {
    const traduzir = (v: string) => ({ Hoje: 'Today', Ontem: 'Yesterday', 'Há {dias} dias': '{dias} days ago' }[v] || v);
    expect(rotuloDataAviso('2026-11-25T18:00:00Z', '2026-11-26', traduzir, 'en')).toBe('Yesterday');
    expect(rotuloDataAviso('2026-11-24T18:00:00Z', '2026-11-26', traduzir, 'en')).toBe('2 days ago');
    expect(rotuloDataAviso('2026-10-24T18:00:00Z', '2026-11-26', traduzir, 'en')).toBe('Oct 24');
  });
});
