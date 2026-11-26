import { expect, it, vi } from 'vitest';
import { capturarSelfieEmMemoria } from '../lib/capturaSelfie';

it('entrega somente o base64 depois de apagar o JPEG temporário', async () => {
  let liberar!: () => void;
  const apagar = vi.fn(() => new Promise<void>(r => { liberar = r; }));
  const entregue = vi.fn();
  const resultado = capturarSelfieEmMemoria(async () => ({ uri: 'cache/Camera/selfie.jpg', base64: 'YQ==' }), apagar).then(entregue);
  await vi.waitFor(() => expect(apagar).toHaveBeenCalledWith('cache/Camera/selfie.jpg'));
  expect(entregue).not.toHaveBeenCalled();
  liberar(); await resultado;
  expect(entregue).toHaveBeenCalledWith('data:image/jpeg;base64,YQ==');
});
it.each([undefined, '', '<script>'])('apaga a foto mesmo com base64 inválido: %s', async base64 => {
  const apagar = vi.fn().mockResolvedValue(undefined);
  expect(await capturarSelfieEmMemoria(async () => ({ uri: 'cache/Camera/selfie.jpg', base64 }), apagar)).toBeNull();
  expect(apagar).toHaveBeenCalledOnce();
});
it('não prossegue quando a limpeza da foto falha', async () => {
  await expect(capturarSelfieEmMemoria(async () => ({ uri: 'cache/Camera/selfie.jpg', base64: 'YQ==' }), async () => { throw new Error('io'); })).rejects.toThrow('io');
});
it('propaga erro de câmera sem tentar apagar um caminho inventado', async () => {
  const apagar = vi.fn();
  await expect(capturarSelfieEmMemoria(async () => { throw new Error('camera'); }, apagar)).rejects.toThrow('camera');
  expect(apagar).not.toHaveBeenCalled();
});
