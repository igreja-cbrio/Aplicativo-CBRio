import {
  SensorType,
  useAnimatedSensor,
  useDerivedValue,
} from "react-native-reanimated";

/**
 * Lê a inclinação do aparelho (giroscópio) para mover o brilho holográfico.
 * Retorna `pitch` (inclinar frente/trás) e `roll` (inclinar esquerda/direita).
 *
 * Portado do demo "threads-holo-ticket" (enzomanuelmangano) — compatível com
 * Reanimated v3 (Expo SDK 51).
 */
export function useDeviceTilt() {
  const sensor = useAnimatedSensor(SensorType.ROTATION, { interval: 16 });

  const pitch = useDerivedValue(() => sensor.sensor.value.pitch || 0);
  const roll = useDerivedValue(() => sensor.sensor.value.roll || 0);

  return { pitch, roll };
}
