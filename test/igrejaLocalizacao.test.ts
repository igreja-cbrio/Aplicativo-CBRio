import { describe, expect, it, vi } from 'vitest';
import { DESTINO_IGREJA, linksIgreja, abrirMapaIgreja } from '../lib/igrejaLocalizacao';
describe('Como chegar à igreja', () => {
  it('envia rua, número, bairro e cidade completos ao Apple Maps e ao Waze', () => {
    const links = linksIgreja('ios');
    expect(DESTINO_IGREJA).toBe('Avenida das Américas, 7907, Barra da Tijuca, Rio de Janeiro, RJ, Brasil');
    expect(new URL(links.mapas).searchParams.get('daddr')).toBe(DESTINO_IGREJA);
    expect(new URL(links.waze).searchParams.get('q')).toBe(DESTINO_IGREJA);
    expect(new URL(links.waze).searchParams.get('navigate')).toBe('yes');
    expect(links.mapas).not.toContain('CBRio+Barra');
  });
  it('Android usa o mapa do aparelho e abre a alternativa web se não houver aplicativo', async () => {
    const abrir = vi.fn().mockRejectedValueOnce(new Error('sem aplicativo')).mockResolvedValueOnce(undefined);
    await abrirMapaIgreja('mapas', 'android', abrir);
    expect(abrir.mock.calls[0][0]).toBe(`geo:0,0?q=${encodeURIComponent(DESTINO_IGREJA)}`);
    expect(new URL(abrir.mock.calls[1][0]).searchParams.get('destination')).toBe(DESTINO_IGREJA);
  });
  it('escolher Waze não abre outro aplicativo de mapas', async () => {
    const abrir = vi.fn().mockResolvedValue(undefined);
    await abrirMapaIgreja('waze','ios',abrir);
    expect(abrir).toHaveBeenCalledTimes(1);
    expect(new URL(abrir.mock.calls[0][0]).hostname).toBe('waze.com');
  });
  it('propaga falha para a tela avisar em vez de falhar silenciosamente', async () => {
    const abrir = vi.fn().mockRejectedValue(new Error('não abriu'));
    await expect(abrirMapaIgreja('waze','ios',abrir)).rejects.toThrow('não abriu');
    await expect(abrirMapaIgreja('mapas','android',abrir)).rejects.toThrow('não abriu');
  });
});
