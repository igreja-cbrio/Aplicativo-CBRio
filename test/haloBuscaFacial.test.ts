import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
const m=vi.hoisted(()=>({reduce:true,changeReduce:(_b:boolean)=>{},changeState:(_s:string)=>{},start:vi.fn(),stop:vi.fn(),timing:vi.fn(),state:{currentState:'active'}}));
vi.mock('react-native',()=>({
 AccessibilityInfo:{isReduceMotionEnabled:async()=>m.reduce,addEventListener:(_e:string,fn:any)=>{m.changeReduce=fn;return {remove:vi.fn()};}},
 AppState:{get currentState(){return m.state.currentState;},addEventListener:(_e:string,fn:any)=>{m.changeState=fn;return {remove:vi.fn()};}},
 Animated:{View:'AnimatedView',Value:class{setValue(){}stopAnimation(){}interpolate(){return 1;}},timing:m.timing,sequence:(a:any)=>a,loop:()=>({start:m.start,stop:m.stop})},
 Easing:{inOut:(v:any)=>v,sin:()=>{}},Image:'Image',ScrollView:'ScrollView',Text:'Text',View:'View',StyleSheet:{create:(s:any)=>s,absoluteFillObject:{}}
}));
vi.mock('react-native-svg',()=>({default:'Svg',Defs:'Defs',Ellipse:'Ellipse',LinearGradient:'LinearGradient',Stop:'Stop'}));
import { HaloBuscaFacial } from '../components/batismo/HaloBuscaFacial';
let tree:ReactTestRenderer|undefined;
const props={colors:{background:'#fff',text:'#000',textMuted:'#555',primary:'#006655',surfaceAlt:'#eee',border:'#ccc'},t:(s:string)=>s,titulo:'Leitura',detalhe:'Teste',status:'Teste'};
async function montar(extra:Record<string,unknown>={}){await act(async()=>{tree=create(React.createElement(HaloBuscaFacial,{...props,...extra}));});}
beforeEach(()=>{(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;vi.clearAllMocks();m.reduce=true;m.state.currentState='active';});
afterEach(async()=>{if(tree)await act(async()=>tree!.unmount());tree=undefined;});
it('respeita reduzir movimento e para ao ativar essa preferência',async()=>{
 await montar();expect(m.start).not.toHaveBeenCalled();
 await act(async()=>m.changeReduce(false));expect(m.start).toHaveBeenCalledOnce();
 expect(m.timing).toHaveBeenCalledWith(expect.anything(),expect.objectContaining({useNativeDriver:true,isInteraction:false}));
 await act(async()=>m.changeReduce(true));expect(m.stop).toHaveBeenCalledOnce();
});
it('suspende a animação no segundo plano e ao iniciar comparação de fotos',async()=>{
 m.reduce=false;await montar();expect(m.start).toHaveBeenCalledOnce();
 await act(async()=>m.changeState('background'));expect(m.stop).toHaveBeenCalledOnce();
 await act(async()=>m.changeState('active'));expect(m.start).toHaveBeenCalledTimes(2);
 await act(async()=>tree!.update(React.createElement(HaloBuscaFacial,{...props,lendo:false})));expect(m.stop).toHaveBeenCalledTimes(2);
});
it('não inventa percentual na leitura e usa só as contagens recebidas na busca',async()=>{
 await montar();expect(tree!.root.findAllByProps({accessibilityRole:'progressbar'})).toHaveLength(0);
 await act(async()=>tree!.update(React.createElement(HaloBuscaFacial,{...props,progresso:{feitas:12,total:30}})));
 expect(tree!.root.findByProps({accessibilityRole:'progressbar'}).props.accessibilityValue).toEqual({min:0,max:30,now:12});
 await act(async()=>tree!.update(React.createElement(HaloBuscaFacial,{...props,progresso:{feitas:35,total:30}})));
 expect(tree!.root.findByProps({accessibilityRole:'progressbar'}).props.accessibilityValue.now).toBe(30);
});
