import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { useAuth } from './AuthContext';
import { carregarContextoCampus, campusSalvo, salvarCampus, type ContextoCampus } from '@/lib/campus';
import { setCampusSession } from '@/lib/campusSession';

type Value = { contexto: ContextoCampus | null; loading: boolean; error: string | null; ready: boolean; scopeKey: string; selecionar: (id: string) => Promise<void>; recarregar: () => Promise<void> };
const Context = createContext<Value | null>(null);
export function CampusProvider({ children }: { children: ReactNode }) {
  const { user, preview } = useAuth();
  const owner = user?.id || null;
  const [state, setState] = useState({ owner: null as string | null, contexto: null as ContextoCampus | null, loading: true, error: null as string | null, generation: 0 });
  const run = useRef(0);
  const validatedAt = useRef(0);
  const currentOwner = useRef(owner); currentOwner.current = owner;
  const active = useRef<AbortController | null>(null);
  const load = useCallback(async (selected?: string | null) => {
    const attempt = ++run.current;
    active.current?.abort();
    const controller = new AbortController(); active.current = controller;
    const generation = setCampusSession(owner, null);
    setState({ owner, contexto: null, loading: !preview, error: null, generation });
    if (preview || !owner) return;
    const timer = setTimeout(() => controller.abort(), 15_000);
    try {
      const aborted = new Promise<never>((_, reject) => controller.signal.addEventListener('abort', () => reject(new Error('Não foi possível carregar o campus. Tente novamente.')), { once: true }));
      const request = async () => {
        const saved = selected === undefined ? await campusSalvo(owner) : selected;
        if (controller.signal.aborted) throw new Error('Carregamento cancelado.');
        return carregarContextoCampus(saved, controller.signal);
      };
      const contexto = await Promise.race([request(), aborted]);
      if (attempt !== run.current || owner !== currentOwner.current) return;
      const nextGeneration = setCampusSession(owner, contexto.campus_id);
      validatedAt.current = Date.now();
      void salvarCampus(owner, contexto.campus_id);
      setState({ owner, contexto, loading: false, error: null, generation: nextGeneration });
    } catch (error) {
      if (attempt !== run.current || owner !== currentOwner.current) return;
      void salvarCampus(owner, null);
      setState({ owner, contexto: null, loading: false, error: error instanceof Error ? error.message : 'Não foi possível carregar o campus.', generation });
    } finally { clearTimeout(timer); }
  }, [owner, preview]);
  useEffect(() => {
    void load();
    return () => { ++run.current; active.current?.abort(); setCampusSession(null, null); };
  }, [load]);
  useEffect(() => {
    const listener = AppState.addEventListener('change', next => {
      if (next === 'active' && owner && !preview && !state.loading && Date.now() - validatedAt.current > 5 * 60_000) void load();
    });
    return () => listener.remove();
  }, [load, owner, preview, state.loading]);
  const selecionar = async (id: string) => {
    if (!state.contexto?.campi.some(item => item.id === id)) return;
    if (state.contexto.estado === 'preparacao' && id !== state.contexto.campus_legado_id) return;
    await load(id);
  };
  const value: Value = {
    contexto: state.owner === owner ? state.contexto : null,
    loading: state.owner !== owner || state.loading, error: state.error,
    ready: !!preview || (state.owner === owner && !state.loading && !state.error && !!state.contexto?.campus_id),
    scopeKey: `${owner || 'preview'}:${state.contexto?.campus_id || 'sem-campus'}:${state.generation}`,
    selecionar, recarregar: () => load(null),
  };
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useCampus() {
  const value = useContext(Context);
  if (!value) throw new Error('CampusProvider não disponível.');
  return value;
}
