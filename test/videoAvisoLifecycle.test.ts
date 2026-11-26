import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
const h = vi.hoisted(() => ({ focado:true, listener:null as null | ((state:string)=>void), remove:vi.fn(), inject:vi.fn() }));
vi.mock('react-native',()=>({ActivityIndicator:'Loading',Pressable:'Button',View:'View',StyleSheet:{create:(s:any)=>s},AppState:{addEventListener:(_:string,fn:(state:string)=>void)=>{h.listener=fn;return {remove:h.remove};}}}));
vi.mock('react-native-webview',()=>({WebView:'WebView'}));
vi.mock('@react-navigation/native',()=>({useIsFocused:()=>h.focado}));
vi.mock('../components/ui/Typography',()=>({Text:'Text'}));
vi.mock('../contexts/ThemeContext',()=>({useColors:()=>({brandMid:'#fff'})}));
vi.mock('../lib/i18n',()=>({useT:()=>(s:string)=>s}));
import { KidsAvisoVideo } from '../components/kids/KidsAvisoVideo';
let tree:ReactTestRenderer;
const element=()=>React.createElement(KidsAvisoVideo,{uri:'https://test.example/video.mp4',titulo:'Aviso'});
beforeEach(()=>{vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);vi.stubGlobal('React',React);h.focado=true;h.listener=null;vi.clearAllMocks();});
afterEach(async()=>{if(tree)await act(async()=>tree.unmount());vi.unstubAllGlobals();});
async function montar(){await act(async()=>{tree=create(element(),{createNodeMock:e=>e.type==='WebView'?{injectJavaScript:h.inject}:null});});}
it('pausa o vídeo ao deixar a tela e não inicia sozinho ao voltar',async()=>{
 await montar();expect(h.inject).not.toHaveBeenCalled();
 h.focado=false;await act(async()=>tree.update(element()));
 expect(h.inject).toHaveBeenCalledExactlyOnceWith('window.pausar&&window.pausar();true;');
 h.focado=true;await act(async()=>tree.update(element()));expect(h.inject).toHaveBeenCalledOnce();
});
it('pausa ao ficar inativo ou em segundo plano e remove o listener ao desmontar',async()=>{
 await montar();await act(async()=>h.listener!('inactive'));await act(async()=>h.listener!('background'));
 expect(h.inject).toHaveBeenCalledTimes(2);
 await act(async()=>h.listener!('active'));expect(h.inject).toHaveBeenCalledTimes(2);
 await act(async()=>tree.unmount());expect(h.remove).toHaveBeenCalledOnce();
});
it('recupera encerramento do processo nativo do player sem retirar o aviso',async()=>{
 await montar();await act(async()=>tree.root.findByType('WebView' as any).props.onContentProcessDidTerminate());
 expect(tree.root.findAllByType('WebView' as any)).toHaveLength(0);
 await act(async()=>tree.root.findByType('Button' as any).props.onPress());
 const web=tree.root.findByType('WebView' as any);expect(web.props.source.html).toContain('https://test.example/video.mp4');expect(web.props.mediaPlaybackRequiresUserAction).toBe(true);
 await act(async()=>web.props.onRenderProcessGone());expect(tree.root.findAllByType('WebView' as any)).toHaveLength(0);
});
