import { describe, expect, it } from 'vitest';
import { contagemBatismo } from '../lib/batismoContagem';
const inscricao = { status: 'pendente', data_batismo: '2026-11-22', horario_culto: '09:30:00' };
describe('Contagem pessoal do batismo', () => {
  it('conta até a data e o horário escolhidos, no fuso da igreja', () => {
    expect(contagemBatismo(inscricao, Date.parse('2026-11-16T12:00:00-03:00')))
      .toMatchObject({ estado: 'agendado', diasCalendario: 6, dias: 5, horas: 21, minutos: 30, horario: '09:30' });
  });
  it('não vira o dia às 21h no Rio nem depende do fuso do aparelho', () => {
    expect(contagemBatismo(inscricao, Date.parse('2026-11-22T01:00:00Z')))
      .toMatchObject({ estado: 'agendado', diasCalendario: 1, dias: 0, horas: 11, minutos: 30 });
  });
  it('celebra no dia, sem números negativos após o horário', () => {
    expect(contagemBatismo(inscricao, Date.parse('2026-11-22T17:00:00-03:00')))
      .toMatchObject({ estado: 'hoje', dias: 0, horas: 0, minutos: 0 });
  });
  it('sem horário usa somente os dias, nunca inventa uma hora', () => {
    expect(contagemBatismo({ ...inscricao, horario_culto: null }, Date.parse('2026-11-16T12:00:00Z')))
      .toMatchObject({ estado: 'agendado', dias: 6, horas: null, minutos: null });
  });
  it.each([null, '', '2026-02-30', '2026-13-01', '2026-11-22T09:30:00Z'])('não calcula uma data ausente/inválida: %s', data => {
    expect(contagemBatismo({ ...inscricao, data_batismo: data }, Date.parse('2026-11-16T12:00:00Z')))
      .toMatchObject({ estado: 'sem-data', dias: null, horas: null, minutos: null });
  });
  it.each(['25:00', '09:99', '09:30 / 19:00', 'manhã'])('não interpreta horário inválido: %s', horario => {
    expect(contagemBatismo({ ...inscricao, horario_culto: horario }, Date.parse('2026-11-16T12:00:00Z')).horas).toBeNull();
  });
  it('não declara batismo realizado só porque a data passou', () => {
    expect(contagemBatismo(inscricao, Date.parse('2026-11-23T12:00:00Z')).estado).toBe('passado');
  });
  it.each(['realizado', 'cancelado'])('respeita o estado %s mesmo com data futura', status => {
    expect(contagemBatismo({ ...inscricao, status }, Date.parse('2026-11-16T12:00:00Z')).estado).toBe(status);
  });
  it('recalcula na virada do dia e aceita ano bissexto', () => {
    const b = { ...inscricao, data_batismo: '2028-02-29' };
    expect(contagemBatismo(b, Date.parse('2028-02-29T02:59:59Z')).estado).toBe('agendado');
    expect(contagemBatismo(b, Date.parse('2028-02-29T03:00:00Z')).estado).toBe('hoje');
  });
});
