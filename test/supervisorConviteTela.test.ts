import React from 'react';
import {act,create,type ReactTestRenderer} from 'react-test-renderer';
import {beforeEach,afterEach,it,expect,vi} from 'vitest';
const m=vi.hoisted(()=>({params:{} as any,focus:null as any,get:vi.fn(),post:vi.fn(),replace:vi.fn(),limpar:vi.fn()}));
vi.mock('react-native',()=>({View:'View',StyleSheet:{create:(s:any)=>s}}));
vi.mock('expo-router',()=>({useFocusEffect:(cb:any)=>{m.focus=cb;},useLocalSearchParams:()=>m.params,useRouter:()=>({replace:m.replace})}));
vi.mock('@/components/ui/Typography',()=>({Text:'Text'}));
vi.mock('@/components/ui/Button',()=>({Button:'Button'}));
vi.mock('@/contexts/ThemeContext',()=>({useColors:()=>({surface:'white',border:'gray',text:'black'})}));
vi.mock('@/lib/i18n',()=>({useT:()=>((s:string)=>s)}));
vi.mock('@/lib/api',()=>({apiGet:m.get,apiPost:m.post}));
vi.mock('@/lib/supervisorConvitePendente',()=>({limparConviteSupervisor:m.limpar}));
import {ConvitesSupervisor} from '../components/voluntariado/ConvitesSupervisor';
let tree:ReactTestRenderer|undefined;
const flush=async()=>{for(let i=0;i<8;i++)await Promise.resolve();};
async function montar(){await act(async()=>{tree=create(React.createElement(ConvitesSupervisor));});await act(async()=>{m.focus();await flush();});}
beforeEach(()=>{(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;vi.clearAllMocks();m.params={};m.get.mockResolvedValue([{id:'c',nome_area:'Kids',estado:'pendente',expires_at:'2026-11-30'}]);m.post.mockResolvedValue({ok:true});m.limpar.mockResolvedValue(undefined);});
afterEach(async()=>{if(tree)await act(async()=>tree!.unmount());tree=undefined;});
it('mostra convite recebido sem link e só aceita após clique',async()=>{
 await montar();expect(m.get).toHaveBeenCalledWith('/app/voluntariado/supervisor-convites');expect(m.post).not.toHaveBeenCalled();
 await act(async()=>{tree!.root.findByProps({title:'Aceitar convite'}).props.onPress();await flush();});
 expect(m.post).toHaveBeenCalledWith('/app/voluntariado/supervisor-convites/c/aceitar',{});expect(m.replace).toHaveBeenCalledWith('/escala-supervisor');
});
it('conta errada não apresenta ação de aceite',async()=>{
 m.params={convite:'a'.repeat(64)};m.get.mockResolvedValue([]);await montar();
 expect(tree!.root.findAllByProps({title:'Aceitar convite'})).toHaveLength(0);expect(m.post).not.toHaveBeenCalled();
 expect(JSON.stringify(tree!.toJSON())).toContain('não está disponível para a sua conta');
});
it('erro ao aceitar mantém convite e não abre gestão de escala',async()=>{
 m.post.mockRejectedValue(new Error('Convite cancelado'));await montar();
 await act(async()=>{tree!.root.findByProps({title:'Aceitar convite'}).props.onPress();await flush();});
 expect(m.replace).not.toHaveBeenCalled();expect(JSON.stringify(tree!.toJSON())).toContain('Convite cancelado');
});
it('convite terminal limpa intenção e permite ver outros convites',async()=>{
 m.params={convite:'a'.repeat(64)};m.get.mockResolvedValue([{id:'c',nome_area:'Kids',estado:'expirado',expires_at:'2026-11-20'}]);await montar();
 expect(m.limpar).toHaveBeenCalled();expect(tree!.root.findAllByProps({title:'Aceitar convite'})).toHaveLength(0);
 await act(async()=>{tree!.root.findByProps({title:'Ver todos os meus convites'}).props.onPress();await flush();});
 expect(m.replace).toHaveBeenCalledWith('/voluntariado');
});
