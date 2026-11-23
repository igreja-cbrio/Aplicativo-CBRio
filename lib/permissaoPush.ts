export type PermissaoPush = { status: string; canAskAgain?: boolean; ios?: { status?: number } };
export function pushAutorizado(p: PermissaoPush): boolean {
  return p.status === 'granted' || p.ios?.status === 3 || p.ios?.status === 4;
}
export function acaoPermissaoPush(p: PermissaoPush): 'registrar' | 'pedir' | 'configuracoes' {
  if (pushAutorizado(p)) return 'registrar';
  return p.canAskAgain === false ? 'configuracoes' : 'pedir';
}
