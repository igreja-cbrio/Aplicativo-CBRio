import { useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { requireOptionalNativeModule } from 'expo';
import { criarDitado, type MotorDitado, type EstadoDitado } from '@/lib/ditadoAssistente';

// Nunca importar o entrypoint do pacote: ele exige o módulo e quebra OTAs antigos.
const motor = requireOptionalNativeModule<MotorDitado>('ExpoSpeechRecognition');
export function useDitadoAssistente(onTexto: (s: string) => void, onErro: (s: string) => void) {
  const [estado, setEstado] = useState<EstadoDitado>('parado');
  const vivo = useRef(true);
  const refs = useRef({ onTexto, onErro }); refs.current = { onTexto, onErro };
  const controle = useMemo(() => criarDitado(motor, {
    texto: s => { if (vivo.current) refs.current.onTexto(s); }, estado: s => { if (vivo.current) setEstado(s); },
    erro: s => { if (vivo.current) refs.current.onErro(s); },
  }), []);
  useEffect(() => {
    vivo.current = true;
    const sub = AppState.addEventListener('change', s => { if (s === 'background') controle.cancelar(); });
    return () => { vivo.current = false; sub.remove(); controle.cancelar(); };
  }, [controle]);
  return { ...controle, estado, ativo: estado !== 'parado' };
}
