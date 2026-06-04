import { useEffect, useState } from "react";
import { supabase } from "./supabase";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Verifica se o usuário logado pode editar o grupo dado:
 *  - profiles.role in ('admin','diretor') -> sempre pode
 *  - OU profiles.membro_id == mem_grupos.lider_id (se a coluna existir)
 *
 * Recarrega quando o grupoId ou o user muda.
 */
export function useAdminGrupo(grupoId: string | null | undefined) {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    async function check() {
      setLoading(true);
      if (!user?.id) {
        if (alive) {
          setIsAdmin(false);
          setLoading(false);
        }
        return;
      }
      const { data: prof } = await supabase
        .from("profiles")
        .select("role, membro_id")
        .eq("id", user.id)
        .maybeSingle();

      if (prof?.role === "admin" || prof?.role === "diretor") {
        if (alive) {
          setIsAdmin(true);
          setLoading(false);
        }
        return;
      }

      if (grupoId && prof?.membro_id) {
        // Tenta ler lider_id; se a coluna não existir o select retorna erro e
        // a gente assume "não é líder".
        const { data: g } = await supabase
          .from("mem_grupos")
          .select("lider_id")
          .eq("id", grupoId)
          .maybeSingle();
        if (alive) {
          setIsAdmin(!!g && (g as { lider_id?: string }).lider_id === prof.membro_id);
          setLoading(false);
        }
        return;
      }

      if (alive) {
        setIsAdmin(false);
        setLoading(false);
      }
    }
    check();
    return () => {
      alive = false;
    };
  }, [user?.id, grupoId]);

  return { isAdmin, loading };
}
