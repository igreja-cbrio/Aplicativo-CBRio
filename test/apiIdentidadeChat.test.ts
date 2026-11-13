import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const auth = vi.hoisted(() => ({ getSession: vi.fn(), refreshSession: vi.fn() }));
vi.mock('@/lib/supabase', () => ({ supabase: { auth } }));
import { apiGet, apiPost } from '@/lib/api';

const sessao = (id: string, expires_at = Math.floor(Date.now() / 1000) + 3600) => ({
  user: { id }, access_token: `token-ficticio-${id}`, expires_at,
});

describe('requisições do chat vinculadas à pessoa que iniciou', () => {
  beforeEach(() => {
    auth.getSession.mockReset(); auth.refreshSession.mockReset();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) }));
  });
  afterEach(() => vi.unstubAllGlobals());

  it.each(['get', 'post'])('bloqueia %s se a sessão diferida muda de A para B', async (metodo) => {
    let concluir!: (valor: unknown) => void;
    auth.getSession.mockReturnValue(new Promise(resolve => { concluir = resolve; }));
    const pedido = metodo === 'get'
      ? apiGet('/app/assistente/conversa/mensagens', { expectedUserId: 'A' })
      : apiPost('/app/assistente', { texto: 'Mensagem da pessoa A' }, { expectedUserId: 'A' });
    const rejeicao = expect(pedido).rejects.toThrow('Sua sessão mudou');
    concluir({ data: { session: sessao('B') } });
    await rejeicao;
    expect(fetch).not.toHaveBeenCalled();
  });

  it('confere novamente a identidade depois de renovar o token', async () => {
    auth.getSession.mockResolvedValue({ data: { session: sessao('A', 1) } });
    auth.refreshSession.mockResolvedValue({ data: { session: sessao('B') }, error: null });
    await expect(apiPost('/app/assistente', { texto: 'Mensagem de A' }, { expectedUserId: 'A' })).rejects.toThrow('Sua sessão mudou');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('envia quando a sessão continua pertencendo à pessoa esperada', async () => {
    auth.getSession.mockResolvedValue({ data: { session: sessao('A') } });
    await expect(apiPost('/app/assistente', { texto: 'Olá' }, { expectedUserId: 'A' })).resolves.toEqual({ ok: true });
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/app/assistente'), expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer token-ficticio-A' }) }));
  });
});
