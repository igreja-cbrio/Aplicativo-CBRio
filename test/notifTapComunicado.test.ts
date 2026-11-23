import { beforeEach, expect, it, vi } from 'vitest';
const h = vi.hoisted(() => ({ listener: null as null | ((r: any) => void), last: vi.fn(), clear: vi.fn(), get: vi.fn(), set: vi.fn(), navigate: vi.fn(), remove: vi.fn() }));
vi.mock('expo-notifications', () => ({ addNotificationResponseReceivedListener: (f: any) => { h.listener = f; return { remove: h.remove }; }, getLastNotificationResponseAsync: h.last, clearLastNotificationResponseAsync: h.clear }));
vi.mock('@react-native-async-storage/async-storage', () => ({ default: { getItem: h.get, setItem: h.set } }));
vi.mock('expo-router', () => ({ router: { navigate: h.navigate } }));
vi.mock('../lib/telemetria', () => ({ trackEvento: vi.fn() }));
vi.mock('../lib/assistenteChat', () => ({ destinoNotificacaoChat: () => '/assistente' }));
import { attachNotifTapListener } from '../lib/notifTap';
const resposta = { notification: { date: 123, request: { identifier: 'aviso-1', content: { data: { tipo: 'comunicado', comunicado_id: 'teste:privado' } } } } } as any;
const flush = async () => { await new Promise(resolve => setTimeout(resolve, 0)); };
beforeEach(() => { vi.resetAllMocks(); h.last.mockResolvedValue(null); h.get.mockResolvedValue(null); h.set.mockResolvedValue(undefined); h.clear.mockResolvedValue(undefined); });
it('toque externo conduz o teste antigo à resolução de sua inscrição, uma vez', async () => {
 const detach = attachNotifTapListener(); h.listener!(resposta); h.listener!(resposta); await flush();
 expect(h.navigate).toHaveBeenCalledExactlyOnceWith({ pathname: '/mural', params: { comunicado_id: 'teste:privado', abrir_inscricao: '1' } }); detach();
});
it('abertura fria recupera o mesmo destino', async () => {
 h.last.mockResolvedValue(resposta); const detach = attachNotifTapListener(); await flush();
 expect(h.navigate).toHaveBeenCalledOnce(); expect(h.clear).toHaveBeenCalledOnce(); detach();
});
it('reabrir normalmente não repete notificação já consumida', async () => {
 h.last.mockResolvedValue(resposta); h.get.mockResolvedValue(JSON.stringify({ id: 'aviso-1', date: '123' }));
 const detach = attachNotifTapListener(); await flush(); expect(h.navigate).not.toHaveBeenCalled(); detach();
});
it('desmontar enquanto lê a resposta preserva o toque para a próxima montagem', async () => {
 let resolve!: (x: any) => void; h.last.mockReturnValue(new Promise(r => { resolve = r; }));
 const detach = attachNotifTapListener(); detach(); resolve(resposta); await flush();
 expect(h.navigate).not.toHaveBeenCalled(); expect(h.clear).not.toHaveBeenCalled(); expect(h.set).not.toHaveBeenCalled();
});
it('desmontar durante a leitura persistida também não consome o toque', async () => {
 let resolve!: (x: any) => void; h.last.mockResolvedValue(resposta); h.get.mockReturnValue(new Promise(r => { resolve = r; }));
 const detach = attachNotifTapListener(); await flush(); detach(); resolve(null); await flush();
 expect(h.navigate).not.toHaveBeenCalled(); expect(h.clear).not.toHaveBeenCalled();
});
it('um toque novo prevalece sobre a resposta antiga que ainda estava sendo lida', async () => {
 let resolve!: (x: any) => void; h.last.mockReturnValue(new Promise(r => { resolve = r; }));
 const detach = attachNotifTapListener(); h.listener!({ notification: { date: 124, request: { identifier: 'novo', content: { data: { tipo: 'comunicado', comunicado_id: 'novo' } } } } });
 resolve(resposta); await flush(); expect(h.navigate).toHaveBeenCalledExactlyOnceWith({ pathname: '/mural', params: { comunicado_id: 'novo', abrir_inscricao: '1' } }); detach();
});
