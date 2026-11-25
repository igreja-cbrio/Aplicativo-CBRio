import { useEffect, useState } from "react";
import { apiGet } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { censoNoMenu, type CensoNoMenu } from "@/lib/menuRegras";

// Última resposta do servidor, por conta. O menu é montado a cada abertura da
// gaveta; sem isto o item do Censo sumiria e voltaria toda vez que ela abre.
let memoria: { uid: string; status: CensoNoMenu | null } | null = null;

/**
 * Diz se o item "Censo" entra no menu. Pergunta ao `GET /app/censo` a cada
 * abertura da gaveta (é quando a resposta pode ter mudado: a pessoa acabou de
 * responder) e mostra a última resposta conhecida enquanto a nova não chega.
 */
export function useCensoNoMenu(): boolean {
  const { user } = useAuth();
  const uid = user?.id;
  const [status, setStatus] = useState<CensoNoMenu | null | undefined>(
    () => (uid && memoria?.uid === uid ? memoria.status : undefined),
  );
  useEffect(() => {
    if (!uid) { setStatus(undefined); return; }
    let vivo = true;
    apiGet<CensoNoMenu>("/app/censo", { expectedUserId: uid })
      .then((r) => { memoria = { uid, status: r }; if (vivo) setStatus(r); })
      // Sem resposta: mantém o que já se sabia; se não se sabia nada, `null`
      // (o item aparece e a tela /censo explica o erro).
      .catch(() => { if (vivo) setStatus((atual) => (atual === undefined ? null : atual)); });
    return () => { vivo = false; };
  }, [uid]);
  return !!uid && censoNoMenu(status);
}
