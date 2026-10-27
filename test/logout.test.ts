import { describe, it, expect, vi } from 'vitest';
import { logoutWithCleanup } from '../lib/logout';
describe('logout após recuperação de outra conta', () => {
 it('remove push da sessão anterior antes de encerrar localmente', async () => {
  let session: string | null = 'A'; const events: string[] = [];
  const endSession = vi.fn(async scope => { expect(session).toBe('A'); expect(events).toEqual(['cache','biometry','push-A']); session=null; return {error:null}; });
  await logoutWithCleanup({ clearCache: async()=>{events.push('cache');}, disableBiometry:async()=>{events.push('biometry');}, unregisterPush:async()=>{events.push('push-'+session);}, endSession },'local');
  expect(endSession).toHaveBeenCalledWith('local'); expect(session).toBeNull();
 });
 it('propaga falha ao encerrar e não declara logout concluído', async () => { const error = new Error('offline'); await expect(logoutWithCleanup({clearCache:async()=>{},disableBiometry:async()=>{},unregisterPush:async()=>{},endSession:async()=>({error})},'local')).rejects.toBe(error); });
});

// ⚠️ 27/10/2026 · Marcelo: 'global' revogava a sessão do web e do CBRio Staff junto.
describe('sair sem dizer o escopo', () => {
 it('⚠️ encerra só ESTE aparelho (local), nunca global', async () => {
  const endSession = vi.fn(async () => ({ error: null }));
  await logoutWithCleanup({ clearCache: async()=>{}, disableBiometry: async()=>{}, unregisterPush: async()=>{}, endSession });
  expect(endSession).toHaveBeenCalledWith('local');
 });
});
