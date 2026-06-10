import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { AppState } from "react-native";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";

export type MembroBasico = {
  membroId: string | null;
  nome: string;
  cpf: string;
  email: string;
  telefone: string;
  dataNascimento: string | null; // ISO
  voluntario: boolean;
  avatarUrl: string | null;
};

type MembroContextValue = {
  membro: MembroBasico | null;
  loading: boolean;
  reload: () => Promise<void>;
};

const MembroContext = createContext<MembroContextValue | undefined>(undefined);

// Recarrega ao voltar do background só se passou desse tempo (evita dado velho
// sem refazer as consultas a cada vez que o app volta pro foreground).
const STALE_MS = 5 * 60 * 1000;

/**
 * Carrega os dados do membro logado UMA vez por sessão e compartilha com
 * todas as telas autenticadas. Antes, `useMembro` rodava profiles +
 * mem_membros (+ mem_voluntarios) ao focar cada uma das ~12 telas que o
 * usam, repetindo as mesmas consultas a cada navegação. Agora é uma
 * consulta por sessão, com `reload()` manual nos pontos de mutação.
 */
export function MembroProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [membro, setMembro] = useState<MembroBasico | null>(null);
  const [loading, setLoading] = useState(true);
  const carregadoEm = useRef(0);

  const load = useCallback(async () => {
    if (!user?.id) {
      setMembro(null);
      setLoading(false);
      return;
    }
    const { data: prof } = await supabase
      .from("profiles")
      .select("name, email, telefone, membro_id, avatar_url")
      .eq("id", user.id)
      .maybeSingle();

    let base: MembroBasico = {
      membroId: prof?.membro_id ?? null,
      nome: prof?.name ?? "",
      cpf: "",
      email: prof?.email ?? user.email ?? "",
      telefone: prof?.telefone ?? "",
      dataNascimento: null,
      voluntario: false,
      avatarUrl: prof?.avatar_url ?? null,
    };

    if (prof?.membro_id) {
      const { data: m } = await supabase
        .from("mem_membros")
        .select("nome, cpf, email, telefone, data_nascimento, voluntario, foto_url")
        .eq("id", prof.membro_id)
        .maybeSingle();
      if (m) {
        base = {
          membroId: prof.membro_id,
          nome: m.nome ?? base.nome,
          cpf: m.cpf ?? "",
          email: m.email ?? base.email,
          telefone: m.telefone ?? base.telefone,
          dataNascimento: m.data_nascimento ?? null,
          voluntario: !!m.voluntario,
          avatarUrl: base.avatarUrl ?? m.foto_url ?? null,
        };
      }
      // Também é voluntário se tiver vínculo ativo em mem_voluntarios
      if (!base.voluntario) {
        const { data: vols } = await supabase
          .from("mem_voluntarios")
          .select("id")
          .eq("membro_id", prof.membro_id)
          .is("deleted_at", null)
          .limit(1);
        if (vols && vols.length > 0) base.voluntario = true;
      }
    }
    setMembro(base);
    setLoading(false);
    carregadoEm.current = Date.now();
  }, [user?.id]);

  // Carrega ao entrar / trocar de usuário. Limpa o cache na troca.
  useEffect(() => {
    setMembro(null);
    setLoading(true);
    carregadoEm.current = 0;
    load();
  }, [load]);

  // Recarrega ao voltar do background se o dado já está velho (> 5 min).
  useEffect(() => {
    const sub = AppState.addEventListener("change", (estado) => {
      if (
        estado === "active" &&
        user?.id &&
        Date.now() - carregadoEm.current > STALE_MS
      ) {
        load();
      }
    });
    return () => sub.remove();
  }, [load, user?.id]);

  return (
    <MembroContext.Provider value={{ membro, loading, reload: load }}>
      {children}
    </MembroContext.Provider>
  );
}

export function useMembro(): MembroContextValue {
  const ctx = useContext(MembroContext);
  if (!ctx) {
    throw new Error("useMembro precisa estar dentro de <MembroProvider>.");
  }
  return ctx;
}
