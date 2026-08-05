// ============================================================================
// "Posso administrar ESTE grupo?" — pelo PAPEL do servidor (05/08/2026)
//
// ⚠️ ANTES decidia por `profiles.role in ('admin','diretor')` + comparação com
// `mem_grupos.lider_id`. Os dois estão fora do modelo vivo:
//   · `profiles.role` é o esquema APOSENTADO de permissão. Quem tem grupos ≥ 3
//     pela MATRIZ (ex.: a coordenação de Grupos, por boost de área) tem role
//     'assistente' → editava no web e **não** no app. Era a divergência web×app
//     que a varredura de 05/08 achou (item 5 do backlog da auditoria de grupos).
//   · a comparação com `lider_id` era feita no cliente, então trocar o líder no
//     web só refletia aqui se a leitura acertasse a mesma coluna.
//
// Agora quem responde é `GET /app/grupos/papel`, que já implementa a régua
// canônica: `admin_grupos` = nível ≥ 3 no módulo `grupos` (matriz + boost de
// área, calculado pelo middleware) e `grupos_liderados` = os grupos onde a
// pessoa é `lider_id`. Uma régua, no servidor — mudança de cargo/área no web
// passa a valer no app na próxima abertura da tela.
//
// ⚠️ Falha de rede NÃO concede permissão (fail-closed): sem resposta, `isAdmin`
// fica false e a tela mostra o caminho de leitura.
// ============================================================================
import { useEffect, useState } from "react";
import { apiGet } from "./api";

type PapelGrupos = {
  lider?: boolean;
  supervisor?: boolean;
  admin_grupos?: boolean;
  grupos_liderados?: { id: string; nome?: string }[];
  grupos_supervisionados?: { id: string; nome?: string }[];
};

export function useAdminGrupo(grupoId: string | null | undefined) {
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    async function check() {
      setLoading(true);
      if (!grupoId) {
        if (alive) {
          setIsAdmin(false);
          setLoading(false);
        }
        return;
      }
      try {
        const p = await apiGet<PapelGrupos>("/app/grupos/papel");
        const lidera = (p.grupos_liderados || []).some((g) => g.id === grupoId);
        const supervisiona = (p.grupos_supervisionados || []).some((g) => g.id === grupoId);
        if (alive) setIsAdmin(!!p.admin_grupos || lidera || supervisiona);
      } catch {
        if (alive) setIsAdmin(false); // fail-closed
      } finally {
        if (alive) setLoading(false);
      }
    }
    check();
    return () => {
      alive = false;
    };
  }, [grupoId]);

  return { isAdmin, loading };
}
