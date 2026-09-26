import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiGet } from './api';
export type CampusPublico = { id: string; nome: string; slug: string; tipo: string };
export type ContextoCampus = { estado: 'preparacao' | 'ensaio' | 'ativo'; campus_legado_id: string | null; campi: CampusPublico[]; campus_id: string | null };
const chave = (userId: string) => `cbrio:campus:v1:${userId}`;
export async function campusSalvo(userId: string) {
  try { return await AsyncStorage.getItem(chave(userId)); } catch { return null; }
}
export async function salvarCampus(userId: string, campusId: string | null) {
  try {
    if (campusId) await AsyncStorage.setItem(chave(userId), campusId);
    else await AsyncStorage.removeItem(chave(userId));
  } catch { /* A preferência local não decide autorização. */ }
}
export function validarContextoCampus(raw: ContextoCampus): ContextoCampus {
  if (!raw || !['preparacao', 'ensaio', 'ativo'].includes(raw.estado) || !Array.isArray(raw.campi)
    || raw.campi.some(item => !item || typeof item.id !== 'string' || typeof item.nome !== 'string')
    || (raw.campus_id !== null && !raw.campi.some(item => item.id === raw.campus_id))
    || (raw.estado === 'preparacao' && raw.campus_id !== null && raw.campus_id !== raw.campus_legado_id)) {
    throw new Error('Não foi possível validar o campus. Tente novamente.');
  }
  return raw;
}
export async function carregarContextoCampus(selected: string | null, signal?: AbortSignal) {
  return validarContextoCampus(await apiGet<ContextoCampus>('/app/campus/contexto', { campus: false, campusId: selected, signal }));
}
