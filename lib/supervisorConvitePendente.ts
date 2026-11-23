import AsyncStorage from '@react-native-async-storage/async-storage';
import { tokenSupervisor } from './supervisorConvite';
const KEY = 'cbrio.supervisor.convite';
let pendente: { token: string; expires: number } | null = null;
export function temConviteSupervisor() { return !!pendente && pendente.expires > Date.now(); }
export async function guardarConviteSupervisor(valor: unknown) {
  const token = tokenSupervisor(valor);
  if (!token) return;
  pendente = { token, expires: Date.now()+7*864e5 };
  await AsyncStorage.setItem(KEY, JSON.stringify(pendente));
}
export async function lerConviteSupervisor() {
  if (pendente && pendente.expires > Date.now()) return pendente.token;
  pendente = null;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const p = raw ? JSON.parse(raw) : null;
    if (p && p.expires > Date.now() && tokenSupervisor(p.token)) pendente=p;
    else await AsyncStorage.removeItem(KEY);
  } catch { /* Sem storage, os convites nominais continuam em Servir. */ }
  return pendente?.token || null;
}
export async function limparConviteSupervisor() { pendente=null; await AsyncStorage.removeItem(KEY); }
