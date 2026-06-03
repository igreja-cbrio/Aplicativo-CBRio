import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import { supabase } from "./supabase";
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

/** Carrega dados básicos do membro logado (profiles + mem_membros). Recarrega ao focar a tela. */
export function useMembro() {
  const { user } = useAuth();
  const [membro, setMembro] = useState<MembroBasico | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user?.id) {
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
    }
    setMembro(base);
    setLoading(false);
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  return { membro, loading, reload: load };
}
