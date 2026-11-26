import { useCallback, useState } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { diaCivilAvisos } from './dataAvisos';

/** Atualiza na virada do dia, ao voltar ao app e ao reabrir a tela. */
export function useDiaAvisos() {
  const [dia, setDia] = useState(() => diaCivilAvisos(Date.now()));
  useFocusEffect(useCallback(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const atualizar = () => {
      clearTimeout(timer);
      const agora = Date.now();
      // O estado só muda quando vira o dia; não renderiza os vídeos a cada minuto.
      setDia(diaCivilAvisos(agora));
      timer = setTimeout(atualizar, 60_000 - (agora % 60_000));
    };
    const ativar = (estado: string) => {
      clearTimeout(timer);
      if (estado === 'active') atualizar();
    };
    ativar(AppState.currentState ?? 'active');
    const listener = AppState.addEventListener('change', ativar);
    return () => { clearTimeout(timer); listener.remove(); };
  }, []));
  return dia;
}
