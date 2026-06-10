import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Cache local genérico com TTL, estratégia stale-while-revalidate.
 *
 * Pensado pra dados iguais entre usuários (ex.: destaques e cultos da
 * Home), pra cortar consultas repetidas ao Supabase em picos de uso.
 *
 * - Cache válido (dentro do TTL): retorna na hora e revalida em background.
 * - Cache expirado/inexistente: busca, grava e retorna o novo.
 * - Falha de rede: serve o cache mesmo expirado (em vez de vazio).
 * - `forcar` (pull-to-refresh): ignora o cache e busca direto.
 */
const PREFIXO = "cbrio:cache:";

type Envelope<T> = { t: number; v: T };

async function ler<T>(chave: string): Promise<Envelope<T> | null> {
  try {
    const raw = await AsyncStorage.getItem(PREFIXO + chave);
    if (!raw) return null;
    return JSON.parse(raw) as Envelope<T>;
  } catch {
    return null;
  }
}

async function gravar<T>(chave: string, valor: T): Promise<void> {
  try {
    const env: Envelope<T> = { t: Date.now(), v: valor };
    await AsyncStorage.setItem(PREFIXO + chave, JSON.stringify(env));
  } catch {
    /* storage cheio/indisponível — segue sem cache */
  }
}

export async function cacheSWR<T>(
  chave: string,
  buscar: () => Promise<T>,
  opts?: { ttlMs?: number; forcar?: boolean }
): Promise<T> {
  const ttlMs = opts?.ttlMs ?? 10 * 60 * 1000; // 10 min
  const forcar = opts?.forcar ?? false;

  // Pull-to-refresh: ignora o cache, mas grava o resultado pra próxima.
  if (forcar) {
    const novo = await buscar();
    gravar(chave, novo);
    return novo;
  }

  const env = await ler<T>(chave);
  const agora = Date.now();

  // Cache válido -> retorna na hora e revalida em background (best-effort).
  if (env && agora - env.t < ttlMs) {
    buscar()
      .then((novo) => gravar(chave, novo))
      .catch(() => {});
    return env.v;
  }

  // Expirado/inexistente -> busca. Se falhar (offline), serve o stale.
  try {
    const novo = await buscar();
    gravar(chave, novo);
    return novo;
  } catch (e) {
    if (env) return env.v;
    throw e;
  }
}

/** Limpa todo o cache local (ex.: no signOut). */
export async function limparCache(): Promise<void> {
  try {
    const chaves = await AsyncStorage.getAllKeys();
    const minhas = chaves.filter((k) => k.startsWith(PREFIXO));
    if (minhas.length) await AsyncStorage.multiRemove(minhas);
  } catch {
    /* no-op */
  }
}
