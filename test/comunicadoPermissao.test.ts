import { describe, it, expect } from 'vitest';
import { acaoPermissaoPush, pushAutorizado } from '../lib/permissaoPush';
import { destinoComunicado } from '../lib/comunicadoLink';
describe('permissão de notificações', () => {
  it('não pergunta novamente para autorização concedida, provisória ou temporária', () => {
    expect(acaoPermissaoPush({ status: 'granted' })).toBe('registrar');
    expect(pushAutorizado({ status: 'undetermined', ios: { status: 3 } })).toBe(true);
    expect(pushAutorizado({ status: 'undetermined', ios: { status: 4 } })).toBe(true);
  });
  it('pede quando permitido e encaminha recusas definitivas para Configurações', () => {
    expect(acaoPermissaoPush({ status: 'undetermined', canAskAgain: true })).toBe('pedir');
    expect(acaoPermissaoPush({ status: 'denied', canAskAgain: true })).toBe('pedir');
    expect(acaoPermissaoPush({ status: 'denied', canAskAgain: false })).toBe('configuracoes');
  });
});
describe('inscrição de comunicado', () => {
  it('abre apenas rotas existentes ou HTTPS seguro', () => {
    expect(destinoComunicado('/inscricao-batismo')).toEqual({ tipo: 'app', url: '/inscricao-batismo' });
    expect(destinoComunicado('/next')?.tipo).toBe('app');
    expect(destinoComunicado('https://www.cbrio.org/next')?.tipo).toBe('web');
    for (const v of [null, {}, 'javascript:alert(1)', '/rota-inexistente', 'http://example.com', '//example.com', 'https://a:b@example.com']) expect(destinoComunicado(v)).toBeNull();
  });
});
