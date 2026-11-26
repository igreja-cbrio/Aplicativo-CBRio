import { beforeEach, expect, it, vi } from 'vitest';
const m = vi.hoisted(() => ({ optional: vi.fn(), platform: { OS: 'ios' } }));
vi.mock('expo-modules-core', () => ({ requireOptionalNativeModule: m.optional }));
vi.mock('react-native', () => ({ Platform: m.platform }));
import { cameraSelfieDisponivel, carregarCameraSelfie } from '../lib/cameraSelfieNativa';
beforeEach(() => { vi.clearAllMocks(); m.platform.OS = 'ios'; });
it('binário antigo não tenta importar expo-camera e mantém o caminho do picker', () => {
  m.optional.mockReturnValue(null);
  expect(cameraSelfieDisponivel()).toBe(false);
  expect(carregarCameraSelfie()).toBeNull();
});
it('ponte nativa indisponível também permite o fallback', () => {
  m.optional.mockImplementation(() => { throw new Error('ponte'); });
  expect(carregarCameraSelfie()).toBeNull();
});
it('web não tenta acessar a câmera nativa', () => {
  m.platform.OS = 'web';
  expect(carregarCameraSelfie()).toBeNull();
  expect(m.optional).not.toHaveBeenCalled();
});
it.each(['ios', 'android'])('habilita a câmera embutida somente com ExpoCamera presente: %s', platform => {
  m.platform.OS = platform; m.optional.mockReturnValue({});
  expect(cameraSelfieDisponivel()).toBe(true);
  expect(m.optional).toHaveBeenCalledWith('ExpoCamera');
});
