// Pendências da liturgia de vários cultos (ponto vermelho no relógio · 25/11/2026).
// Quem decide o que "falta" é o servidor (`faltasDaLiturgia` no ERP); aqui só
// buscamos em lote e recarregamos ao voltar para a tela (a Produção ou um
// editor pode ter completado a liturgia no meio tempo). Falha de rede = sem
// ponto: o relógio continua abrindo a liturgia, que diz o que falta.
import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import { apiGet } from "@/lib/api";
import { rotaPendencias, type PendenciasLiturgia } from "@/lib/liturgia";

export function usePendenciasLiturgia(serviceIds: (string | null | undefined)[]): PendenciasLiturgia {
  const [pendencias, setPendencias] = useState<PendenciasLiturgia>({});
  const rota = rotaPendencias(serviceIds);
  useFocusEffect(
    useCallback(() => {
      if (!rota) {
        setPendencias({});
        return;
      }
      let vivo = true;
      apiGet<{ pendencias?: PendenciasLiturgia }>(rota)
        .then((r) => vivo && setPendencias(r?.pendencias || {}))
        .catch(() => vivo && setPendencias({}));
      return () => {
        vivo = false;
      };
    }, [rota])
  );
  return pendencias;
}
