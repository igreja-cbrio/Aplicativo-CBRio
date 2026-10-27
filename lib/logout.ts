export type LogoutScope = "global" | "local";
type LogoutDependencies = {
  clearCache: () => Promise<void>;
  disableBiometry: () => Promise<void>;
  unregisterPush: () => Promise<void>;
  endSession: (scope: LogoutScope) => Promise<{ error: unknown }>;
};
/** Push usa RLS: precisa ser removido enquanto a sessão anterior ainda existe.
 *
 * ⚠️⚠️ Padrão 'local' (27/10/2026 · Marcelo saiu de 3 lugares de uma vez): 'global'
 * revoga TODAS as sessões da conta, que é a mesma do sistema web e do CBRio
 * Staff. Sair do app (inclusive pelo "Sair" da tela de biometria) deslogava a
 * pessoa do computador e do outro app. Sair daqui tira só ESTE aparelho. */
export async function logoutWithCleanup(deps: LogoutDependencies, scope: LogoutScope = "local") {
  await deps.clearCache();
  await deps.disableBiometry();
  await deps.unregisterPush();
  const { error } = await deps.endSession(scope);
  if (error) throw error;
}
