import { describe, it, expect } from 'vitest';
import { destinoDevocionalKids } from '../lib/kidsDevocionalDestino';
describe('notificação semanal do Kids', () => {
 it('abre a semana da edição e ignora URLs externas', () => {
  expect(destinoDevocionalKids({ semana: '2026-11-22', url: 'https://example.com' })).toEqual({ pathname: '/devocional-kids', params: { semana: '2026-11-22' } });
 });
 it('aviso sem semana continua abrindo os devocionais', () => {
  expect(destinoDevocionalKids(null)).toEqual({ pathname: '/devocional-kids', params: {} });
  expect(destinoDevocionalKids({ semana: '../rota' }).params).toEqual({});
 });
});
