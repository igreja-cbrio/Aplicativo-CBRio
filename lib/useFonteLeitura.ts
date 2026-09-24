import { useCallback, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { CHAVE_FONTE_LEITURA, PASSO_PADRAO, mudarPasso, normalizarPasso } from "./fonteLeitura";

/**
 * Passo do tamanho de letra das telas de leitura, persistido no aparelho e
 * COMPARTILHADO entre Bíblia e devocional (uma escolha, todas as leituras).
 * Regra pura em `fonteLeitura.ts`; aqui é só o AsyncStorage.
 */
export function useFonteLeitura() {
  const [passo, setPasso] = useState(PASSO_PADRAO);
  useEffect(() => {
    AsyncStorage.getItem(CHAVE_FONTE_LEITURA).then((v) => { if (v != null) setPasso(normalizarPasso(v)); }).catch(() => undefined);
  }, []);
  const mudar = useCallback((direcao: -1 | 1) => {
    setPasso((atual) => {
      const novo = mudarPasso(atual, direcao);
      AsyncStorage.setItem(CHAVE_FONTE_LEITURA, String(novo)).catch(() => undefined);
      return novo;
    });
  }, []);
  return { passo, mudar };
}
