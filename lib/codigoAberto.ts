// Gravação no aparelho do passo do código (27/11/2026). A régua, o porquê e os
// testes estão em lib/codigoAbertoRegra.ts; aqui fica só o AsyncStorage.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { codigoAbertoValido, type CodigoAberto } from "./codigoAbertoRegra";

export { montarCodigoAberto, codigoAbertoValido, type CodigoAberto } from "./codigoAbertoRegra";

const chave = (userId: string) => `cbrio.codigoAberto.${userId}`;

export async function guardarCodigoAberto(userId: string | null | undefined, aberto: CodigoAberto | null) {
  if (!userId || !aberto) return;
  try { await AsyncStorage.setItem(chave(userId), JSON.stringify(aberto)); } catch { /* sem disco: segue sem guardar */ }
}

export async function lerCodigoAberto(userId: string | null | undefined, agora: number = Date.now()): Promise<CodigoAberto | null> {
  if (!userId) return null;
  try {
    const texto = await AsyncStorage.getItem(chave(userId));
    if (!texto) return null;
    const valido = codigoAbertoValido(JSON.parse(texto), agora);
    if (!valido) await AsyncStorage.removeItem(chave(userId));
    return valido;
  } catch {
    return null;
  }
}

export async function limparCodigoAberto(userId: string | null | undefined) {
  if (!userId) return;
  try { await AsyncStorage.removeItem(chave(userId)); } catch { /* nada a fazer */ }
}
