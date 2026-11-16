import { useCallback, useState } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

/** Recalcula ao voltar ao app/tela, sem manter relógio em segundo plano. */
export function useRelogioBatismo() {
  const [agora, setAgora] = useState(Date.now);
  useFocusEffect(useCallback(() => {
    let timer: ReturnType<typeof setInterval> | undefined;
    const atualizar = () => setAgora(Date.now());
    const ativar = (estado: string) => {
      clearInterval(timer);
      if (estado === 'active') {
        atualizar();
        timer = setInterval(atualizar, 30000);
      }
    };
    ativar(AppState.currentState ?? 'active');
    const listener = AppState.addEventListener('change', ativar);
    return () => { clearInterval(timer); listener.remove(); };
  }, []));
  return agora;
}
