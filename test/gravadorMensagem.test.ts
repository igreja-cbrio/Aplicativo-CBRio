import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { beforeEach, afterEach, it, expect, vi } from 'vitest';
const m=vi.hoisted(()=>({permission:vi.fn(),mode:vi.fn(),prepare:vi.fn(),stop:vi.fn(),record:vi.fn(),deleted:vi.fn(),callback:null as any,focus:null as any,appState:[] as any[],player:{pause:vi.fn(),play:vi.fn(),seekTo:vi.fn()}}));
vi.mock('expo-router',()=>({useFocusEffect:(cb:any)=>{m.focus=cb;}}));
vi.mock('react-native',()=>({View:'View',Pressable:'Pressable',ActivityIndicator:'ActivityIndicator',AppState:{addEventListener:(_n:string,cb:any)=>{m.appState.push(cb);return {remove:()=>{m.appState=m.appState.filter(x=>x!==cb);}};}}}));
vi.mock('@/components/ui/Typography',()=>({Text:'Text'}));
vi.mock('@/contexts/ThemeContext',()=>({useColors:()=>({brandMid:'blue',text:'black',surface:'white'})}));
vi.mock('@/lib/i18n',()=>({useT:()=>((s:string)=>s)}));
vi.mock('react-native-svg',()=>({default:'Svg',Path:'Path',Rect:'Rect'}));
vi.mock('expo-file-system',()=>({File:class {exists=true;size=500;delete(){m.deleted();}}}));
vi.mock('@/lib/audioNativo',()=>({temAudioNativo:true,carregarAudio:()=>({RecordingPresets:{HIGH_QUALITY:{}},useAudioRecorder:(_o:any,cb:any)=>{m.callback=cb;return {uri:'file:///voz.m4a',stop:m.stop,prepareToRecordAsync:m.prepare,record:m.record};},useAudioRecorderState:()=>({durationMillis:0}),requestRecordingPermissionsAsync:m.permission,setAudioModeAsync:m.mode,useAudioPlayer:()=>m.player,useAudioPlayerStatus:()=>({isLoaded:true,playing:false,duration:3})})}));
import { GravadorMensagem, PreviaAudio, reterAudio, apagarAudio } from '../components/chat/GravadorMensagem';
let tree:ReactTestRenderer|undefined;
const flush=async()=>{for(let i=0;i<8;i++)await Promise.resolve();};
const props=()=>({disabled:false,iniciar:vi.fn(),ativo:vi.fn(),pronto:vi.fn(),erro:vi.fn()});
async function montar(p=props()){await act(async()=>{tree=create(React.createElement(GravadorMensagem,p));});return p;}
async function tocar(label:string){await act(async()=>{tree!.root.findByProps({accessibilityLabel:label}).props.onPress();await flush();});}
beforeEach(()=>{(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;m.permission.mockReset().mockResolvedValue({granted:true});m.mode.mockReset().mockResolvedValue(undefined);m.prepare.mockReset().mockResolvedValue(undefined);m.stop.mockReset().mockResolvedValue(undefined);m.record.mockReset();m.deleted.mockReset();m.player.play.mockReset();m.player.pause.mockReset();m.appState=[];vi.spyOn(Date,'now').mockReturnValue(1000);});
afterEach(async()=>{if(tree)await act(async()=>{tree!.unmount();await flush();});tree=undefined;});
it('permissão iOS inactive não cancela; para e devolve arquivo real para prévia sem enviar',async()=>{let concluir:any;m.permission.mockReturnValue(new Promise(r=>concluir=r));const p=await montar();await tocar('Gravar áudio');await act(async()=>{m.appState.forEach(cb=>cb('inactive'));concluir({granted:true});await flush();});expect(m.record).toHaveBeenCalledWith({forDuration:120});vi.mocked(Date.now).mockReturnValue(3000);await tocar('Parar gravação');expect(p.pronto).toHaveBeenCalledWith({uri:'file:///voz.m4a',name:'audio-3000.m4a',type:'audio/mp4'});});
it('sair enquanto permissão está aberta não inicia gravação tardia',async()=>{let concluir:any;m.permission.mockReturnValue(new Promise(r=>concluir=r));const p=await montar();await tocar('Gravar áudio');await act(async()=>{tree!.unmount();tree=undefined;});await act(async()=>{concluir({granted:true});await flush();});expect(m.record).not.toHaveBeenCalled();expect(p.pronto).not.toHaveBeenCalled();});
it('background descarta áudio e não envia',async()=>{const p=await montar();await tocar('Gravar áudio');await act(async()=>{m.appState.forEach(cb=>cb('background'));await flush();});expect(m.stop).toHaveBeenCalled();expect(p.pronto).not.toHaveBeenCalled();expect(m.deleted).toHaveBeenCalled();});
it('evento nativo de limite finaliza mesmo com duração de polling zerada',async()=>{const p=await montar();await tocar('Gravar áudio');vi.mocked(Date.now).mockReturnValue(121000);await act(async()=>{m.callback({isFinished:true,hasError:false});await flush();});expect(p.pronto).toHaveBeenCalledTimes(1);});
it('arquivo em voo só é apagado após terminar upload',()=>{const soltar=reterAudio('file:///teste.m4a');apagarAudio('file:///teste.m4a');expect(m.deleted).not.toHaveBeenCalled();soltar();expect(m.deleted).toHaveBeenCalledTimes(1);});
it('prévia não começa a tocar após desmontagem durante preparo',async()=>{let concluir:any;m.mode.mockReturnValue(new Promise(r=>concluir=r));await act(async()=>{tree=create(React.createElement(PreviaAudio,{uri:'file:///voz.m4a',busy:false}));});await act(async()=>{tree!.root.findByType('Pressable' as any).props.onPress();await flush();});await act(async()=>{tree!.unmount();tree=undefined;});await act(async()=>{concluir();await flush();});expect(m.player.play).not.toHaveBeenCalled();});

it('cancelar enquanto a parada aguarda impede entregar a gravação',async()=>{let concluir:any;m.stop.mockReturnValue(new Promise(r=>concluir=r));const p=await montar();await tocar('Gravar áudio');vi.mocked(Date.now).mockReturnValue(3000);await tocar('Parar gravação');await act(async()=>{tree!.root.findAllByType('Pressable' as any).find(x=>x.findAllByType('Text' as any).some(t=>t.children.includes('Cancelar gravação')))!.props.onPress();concluir();await flush();});expect(p.pronto).not.toHaveBeenCalled();});

it('prévia pausa e invalida reprodução ao perder foco sem desmontar',async()=>{let concluir:any;m.mode.mockReturnValue(new Promise(r=>concluir=r));await act(async()=>{tree=create(React.createElement(PreviaAudio,{uri:'file:///voz.m4a',busy:false}));});const blur=m.focus();await act(async()=>{tree!.root.findByType('Pressable' as any).props.onPress();await flush();});await act(async()=>{blur();concluir();await flush();});expect(m.player.pause).toHaveBeenCalled();expect(m.player.play).not.toHaveBeenCalled();});

it('limpa estado de gravação antes de entregar prévia que desmonta o componente',async()=>{const p=await montar();await tocar('Gravar áudio');vi.mocked(Date.now).mockReturnValue(3000);p.pronto.mockImplementation(()=>{expect(p.ativo).toHaveBeenLastCalledWith(false);});await tocar('Parar gravação');expect(p.pronto).toHaveBeenCalledTimes(1);});

// 24/11/2026 · enviar o áudio desmonta a prévia; o expo-audio já liberou o player
// e `pause()` lança NativeSharedObjectNotFoundException. Isso derrubava a tela
// ("Algo deu errado") no iPhone 1.0.5 build 53.
it('pausar um player já liberado não derruba a tela (enviar o áudio desmonta a prévia)',async()=>{await act(async()=>{tree=create(React.createElement(PreviaAudio,{uri:'file:///voz.m4a',busy:false}));});const sair=m.focus();m.player.pause.mockImplementation(()=>{throw new Error('NativeSharedObjectNotFoundException');});expect(()=>sair()).not.toThrow();expect(()=>m.appState.forEach(cb=>cb('background'))).not.toThrow();await act(async()=>{tree!.update(React.createElement(PreviaAudio,{uri:'file:///voz.m4a',busy:true}));});expect(m.player.pause).toHaveBeenCalledTimes(3);});
it('na prévia, todo pause passa pela pausa que não quebra',()=>{const fonte=require('node:fs').readFileSync(require('node:path').join(__dirname,'../components/chat/GravadorMensagem.tsx'),'utf8');const usos=fonte.match(/player\.pause\(\)/g)||[];expect(usos.length).toBe(1);expect(fonte).toMatch(/try \{ player\.pause\(\); \} catch/);});
