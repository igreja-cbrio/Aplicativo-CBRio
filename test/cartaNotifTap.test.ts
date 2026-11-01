import { expect, it, vi } from 'vitest';
const mocks=vi.hoisted(()=>({navigate:vi.fn(),handler:null as null|((r:any)=>void),remove:vi.fn()}));
vi.mock('expo-router',()=>({router:{navigate:mocks.navigate}}));
vi.mock('expo-notifications',()=>({
 addNotificationResponseReceivedListener:(h:any)=>{mocks.handler=h;return{remove:mocks.remove};},
 getLastNotificationResponseAsync:()=>Promise.resolve(null),clearLastNotificationResponseAsync:()=>Promise.resolve(),
}));
vi.mock('@react-native-async-storage/async-storage',()=>({default:{getItem:()=>Promise.resolve(null),setItem:()=>Promise.resolve()}}));
vi.mock('../lib/telemetria',()=>({trackEvento:vi.fn()}));
import { attachNotifTapListener } from '../lib/notifTap';
it('toque no aviso de carta pronta abre a tela e não repete navegação no mesmo push',()=>{
 const stop=attachNotifTapListener();
 const response={notification:{date:123,request:{identifier:'pdf-pronto',content:{data:{tipo:'carta_transferencia_pronta',pedido_id:'p'}}}}};
 mocks.handler!(response);mocks.handler!(response);
 expect(mocks.navigate).toHaveBeenCalledTimes(1);expect(mocks.navigate).toHaveBeenCalledWith('/carta-transferencia');
 stop();expect(mocks.remove).toHaveBeenCalled();
});
