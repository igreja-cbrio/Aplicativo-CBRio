export type LogoutScope = "global" | "local";
type LogoutDependencies = {
  clearCache: () => Promise<void>;
  disableBiometry: () => Promise<void>;
  unregisterPush: () => Promise<void>;
  endSession: (scope: LogoutScope) => Promise<{ error: unknown }>;
};
/** Push usa RLS: precisa ser removido enquanto a sessão anterior ainda existe. */
export async function logoutWithCleanup(deps: LogoutDependencies, scope: LogoutScope = "global") {
  await deps.clearCache();
  await deps.disableBiometry();
  await deps.unregisterPush();
  const { error } = await deps.endSession(scope);
  if (error) throw error;
}
