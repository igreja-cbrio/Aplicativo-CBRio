import { describe, expect, it } from 'vitest';
import { conviteBatismo } from '../lib/batismoConvite';
const agora = Date.parse('2026-11-16T18:00:00Z');
const inscricao = { nome: 'Ana', sobrenome: 'Conceição', status: 'pendente', data_batismo: '2026-11-22', horario_culto: '09:30:00' };
describe('convite pessoal de batismo', () => {
  it('usa os dados da inscrição e identifica o fuso', () => {
    const c = conviteBatismo(inscricao, agora)!;
    expect(c.nome).toBe('Ana Conceição');
    expect(c.texto).toContain('22/11/2026');
    expect(c.texto).toContain('09:30 · Horário de Brasília');
  });
  it.each(['cancelado', 'realizado'])('não convida para inscrição %s', status => {
    expect(conviteBatismo({ ...inscricao, status }, agora)).toBeNull();
  });
  it.each([null, '2026-02-30', '2026-11-15'])('não inventa data nem convida para data passada: %s', data_batismo => {
    expect(conviteBatismo({ ...inscricao, data_batismo }, agora)).toBeNull();
  });
  it('permite convite no próprio dia e não inventa horário', () => {
    const c = conviteBatismo({ ...inscricao, data_batismo: '2026-11-16', horario_culto: null }, agora)!;
    expect(c.horario).toBe('Horário a confirmar');
  });
  it('não inclui observações ou dados privados', () => {
    const extra = { ...inscricao, observacoes: 'DADO PRIVADO', cpf: '12345678900', email: 'privado@exemplo.com' };
    const texto = conviteBatismo(extra, agora)!.texto;
    expect(texto).not.toContain(extra.observacoes);
    expect(texto).not.toContain(extra.cpf);
    expect(texto).not.toContain(extra.email);
  });
});
