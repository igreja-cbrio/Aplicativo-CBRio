import { useEffect, useState } from "react";
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
};

/** Carrega dados básicos do membro logado (profiles + mem_membros) p/ pré-preencher. */
export function useMembro() {
  const { user } = useAuth();
  const [membro, setMembro] = useState<MembroBasico | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) {
      setLoading(false);
      return;
    }
    (async () => {
      const { data: prof } = await supabase
        .from("profiles")
        .select("name, email, telefone, membro_id")
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
      };

      if (prof?.membro_id) {
        const { data: m } = await supabase
          .from("mem_membros")
          .select("nome, cpf, email, telefone, data_nascimento, voluntario")
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
          };
        }
      }
      setMembro(base);
      setLoading(false);
    })();
  }, [user?.id]);

  return { membro, loading };
}
