import React from 'react';
import {act,create,type ReactTestRenderer} from 'react-test-renderer';
import {beforeEach,afterEach,expect,it,vi} from 'vitest';
const m=vi.hoisted(()=>({native:true,permission:vi.fn(),picker:vi.fn(),consent:vi.fn(),cleanup:vi.fn(),list:vi.fn(),close:vi.fn(),result:vi.fn(),inject:vi.fn()}));
vi.mock('react-native',()=>({ActivityIndicator:'Spinner',AppState:{currentState:'active',addEventListener:()=>({remove(){}})},Linking:{openSettings:vi.fn()},Pressable:'Pressable',ScrollView:'ScrollView',View:'View',StyleSheet:{create:(s:any)=>s}}));
vi.mock('@/components/navigation/DockContent',()=>({Modal:'Modal'}));
vi.mock('@/components/ui/Typography',()=>({Text:'Text'}));
vi.mock('@/components/ui/Checkbox',()=>({Checkbox:'Checkbox'}));
vi.mock('@/components/ui/Button',()=>({Button:'Button'}));
vi.mock('@expo/vector-icons',()=>({Ionicons:'Icon'}));
vi.mock('react-native-safe-area-context',()=>({useSafeAreaInsets:()=>({top:0,bottom:0})}));
vi.mock('react-native-webview',()=>({default:'WebView'}));
vi.mock('expo-image-picker',()=>({requestCameraPermissionsAsync:m.permission,launchCameraAsync:m.picker,CameraType:{front:'front'}}));
vi.mock('expo-file-system/legacy',()=>({deleteAsync:m.cleanup}));
vi.mock('@/contexts/ThemeContext',()=>({useColors:()=>({background:'#fff',text:'#000',primary:'#006655'})}));
vi.mock('@/lib/i18n',()=>({useLang:()=>({lang:'pt-BR'}),useT:()=>((s:string)=>s)}));
vi.mock('@/lib/batismoFotos',()=>({registrarConsentimentoBusca:m.consent}));
vi.mock('@/lib/telaAcordada',()=>({manterTelaAcordada:vi.fn(),liberarTela:vi.fn()}));
vi.mock('@/lib/limparSobrasCamera',()=>({limparSobrasDaCamera:async()=>{}}));
vi.mock('@/lib/cameraSelfieNativa',()=>({cameraSelfieDisponivel:()=>m.native}));
vi.mock('../components/batismo/CameraSelfieHalo',()=>({CameraSelfieHalo:'CameraHalo'}));
vi.mock('../components/batismo/HaloBuscaFacial',()=>({HaloBuscaFacial:'Halo'}));
import {BuscaFacial} from '../components/batismo/BuscaFacial';
import {ORIGEM_BUSCA_FACIAL,PREFIXO_URL_BUSCA} from '../lib/buscaFacial';
let tree:ReactTestRenderer|undefined;
async function montar(){await act(async()=>{tree=create(React.createElement(BuscaFacial,{albumId:'album-teste',totalEstimado:1,carregarTodas:m.list,onFechar:m.close,onResultado:m.result}),{createNodeMock:e=>e.type===('WebView' as any)?{injectJavaScript:m.inject}:null});});}
async function aceitar(){await act(async()=>{for(const c of tree!.root.findAllByType('Checkbox' as any))c.props.onChange(true);});}
const tirar=()=>tree!.root.findByProps({title:'Tirar selfie'}).props.onPress();
async function msg(data:any){await act(async()=>tree!.root.findByType('WebView' as any).props.onMessage({nativeEvent:{url:ORIGEM_BUSCA_FACIAL,data:JSON.stringify(data)}}));}
beforeEach(()=>{(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;vi.stubGlobal('React',React);vi.clearAllMocks();m.native=true;m.permission.mockResolvedValue({granted:true});m.consent.mockResolvedValue(undefined);m.cleanup.mockResolvedValue(undefined);m.picker.mockResolvedValue({canceled:false,assets:[{uri:'cache/selfie.jpg',base64:'YQ=='}]});m.list.mockResolvedValue([{id:'f1',nome:'Teste',tamanho:null,miniatura:null,grande:null,busca:PREFIXO_URL_BUSCA+'eyJ1IjoiYSJ9.AbC-123_xyz'}]);});
afterEach(async()=>{if(tree)await act(async()=>tree!.unmount());tree=undefined;vi.unstubAllGlobals();});
it('não abre câmera sem os dois aceites; registra consentimento antes da permissão',async()=>{
 await montar();await act(async()=>tirar());expect(m.permission).not.toHaveBeenCalled();expect(m.consent).not.toHaveBeenCalled();
 await aceitar();await act(async()=>tirar());expect(m.consent.mock.invocationCallOrder[0]).toBeLessThan(m.permission.mock.invocationCallOrder[0]);
 expect(tree!.root.findAllByType('CameraHalo' as any)).toHaveLength(1);expect(m.list).not.toHaveBeenCalled();expect(m.picker).not.toHaveBeenCalled();
});
it.each(['consent','permission'])('não monta câmera se %s falhar',async etapa=>{
 if(etapa==='consent')m.consent.mockRejectedValue(new Error('falha'));else m.permission.mockResolvedValue({granted:false});
 await montar();await aceitar();await act(async()=>tirar());expect(tree!.root.findAllByType('CameraHalo' as any)).toHaveLength(0);expect(m.list).not.toHaveBeenCalled();
});
it('mantém o picker em binários antigos e mostra halo após a captura',async()=>{
 m.native=false;await montar();await aceitar();await act(async()=>tirar());
 expect(m.picker).toHaveBeenCalledOnce();expect(m.cleanup).toHaveBeenCalledOnce();expect(tree!.root.findByType('Halo' as any).props.selfie).toBe('data:image/jpeg;base64,YQ==');
});
it('halo acompanha mensagens reais do motor e resultado mantém somente ids e contagens',async()=>{
 await montar();await aceitar();await act(async()=>tirar());await act(async()=>tree!.root.findByType('CameraHalo' as any).props.onSelfie('data:image/jpeg;base64,YQ=='));
 expect(tree!.root.findByType('Halo' as any).props.progresso).toBeUndefined();
 await msg({t:'pronto'});expect(m.inject).toHaveBeenCalled();await msg({t:'modelos'});expect(tree!.root.findByType('Halo' as any).props.titulo).toBe('Lendo seu rosto');
 await msg({t:'selfie'});expect(tree!.root.findByType('Halo' as any).props.lendo).toBe(false);
 await msg({t:'foto',id:'f1',d:0.1});expect(tree!.root.findByType('Halo' as any).props.progresso).toEqual({feitas:1,total:1});
 await msg({t:'fim',feitas:1,total:1,falhas:0});expect(m.result).toHaveBeenCalledOnce();expect(JSON.stringify(m.result.mock.calls)).not.toContain('data:image');
});
it('fechar enquanto aguarda consentimento impede abrir a câmera depois',async()=>{
 let resolver!:()=>void;m.consent.mockImplementation(()=>new Promise<void>(r=>{resolver=r;}));await montar();await aceitar();let promessa!:Promise<void>;
 await act(async()=>{promessa=tirar();});await act(async()=>tree!.root.findByType('Modal' as any).props.onRequestClose());
 await act(async()=>{resolver();await promessa;});expect(m.close).toHaveBeenCalledOnce();expect(m.permission).not.toHaveBeenCalled();
});
