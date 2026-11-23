import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo';
export const temAudioNativo = Platform.OS !== 'web' && !!requireOptionalNativeModule('ExpoAudio');
export function carregarAudio(): typeof import('expo-audio') {
  if (!temAudioNativo) throw new Error('Gravador indisponível nesta versão');
  return require('expo-audio');
}
