import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { beforeEach, afterEach, it, expect, vi } from 'vitest';
const m=vi.hoisted(()=>({get:vi.fn(),post:vi.fn(),detalhe:vi.fn(),user:'pai',t:(s:string)=>s}));
vi.mock('react-native',()=>({View:'View',Pressable:'Pressable',ActivityIndicator:'ActivityIndicator',StyleSheet:{create:(s:any)=>s}}));
vi.mock('@/contexts/AuthContext',()=>({useAuth:()=>({user:{id:m.user}})}));
vi.mock('@/contexts/ThemeContext',()=>({useColors:()=>({surface:'white',border:'gray',text:'black'})}));
vi.mock('@/lib/i18n',()=>({useT:()=>m.t}));
vi.mock('@/components/ui/Typography',()=>({Text:'Text'}));
vi.mock('@/components/ui/Input',()=>({Input:'Input'}));
vi.mock('@/components/ui/Button',()=>({Button:'Button'}));
vi.mock('@/components/ui/Checkbox',()=>({Checkbox:'Checkbox'}));
vi.mock('@/components/ui/TecladoSeguro',()=>({TecladoSeguro:'TecladoSeguro'}));
vi.mock('@/components/navigation/DockContent',()=>({ScrollView:'ScrollView'}));
vi.mock('react-native-safe-area-context',()=>({SafeAreaView:'SafeAreaView'}));
vi.mock('@expo/vector-icons',()=>({Ionicons:'Ionicons'}));
vi.mock('expo-router',async()=>{const React=await import('react');return {Stack:{Screen:'Screen'},useFocusEffect:(f:any)=>React.useEffect(f,[f])};});
vi.mock('@/lib/hierarquia',()=>({subirUmNivel:vi.fn()}));
vi.mock('@/components/ui/Dialogo',()=>({useDialogo:()=>({confirmar:()=>Promise.resolve(true),Dialogo:()=>null})}));
vi.mock('@/components/kids/FilhosInscricao',()=>({FilhosInscricao:'FilhosInscricao',useFilhosInscricao:()=>({dados:{responsavel:{telefone:'21999998888',email:'pai@example.test'}},carregando:false,erro:false})}));
vi.mock('@/lib/api',()=>({apiGet:m.get,apiPost:m.post}));
vi.mock('@/lib/kidsFilhosInscricao',()=>({detalheFilhoInscricao:m.detalhe,nascimentoBR:(s:string)=>s?s.split('-').reverse().join('/'):''}));
import Tela from '../app/(app)/(principal)/apresentacao-crianca';
let tree:ReactTestRenderer|undefined;
beforeEach(()=>{(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;vi.clearAllMocks();m.user='pai';m.get.mockImplementation((p:string)=>Promise.resolve(p.includes('/termos?')?{versao:'v1',imagem:'Imagem criança',genitores:'Genitores',aviso:'Aviso'}:{proxima_data:'2026-12-27',pedidos:[],pode_indicar_vinculo:true,familia:null}));m.detalhe.mockResolvedValue({chave:'kids:1',nome:'Criança Exemplo',data_nascimento:'2020-03-10',sexo:'M',saude:{}});m.post.mockResolvedValue({data_apresentacao:'2026-12-27'});});
afterEach(async()=>{if(tree)await act(async()=>tree!.unmount());tree=undefined;});
async function montar(){await act(async()=>{tree=create(React.createElement(Tela));});}
async function selecionar(){await act(async()=>{await tree!.root.findByType('FilhosInscricao' as any).props.escolher('kids:1');});}
const botao=()=>tree!.root.findByProps({title:'Registrar apresentação'});
async function aceitar(){await act(async()=>{tree!.root.findByProps({label:'Imagem criança'}).props.onChange(true);tree!.root.findByProps({label:'Genitores'}).props.onChange(true);});}
it('filho selecionado exige os dois aceites e envia a versão',async()=>{
 await montar();await selecionar();expect(botao().props.disabled).toBe(true);
 await act(async()=>{await botao().props.onPress();});expect(m.post).not.toHaveBeenCalled();
 await act(async()=>{tree!.root.findByProps({label:'Imagem criança'}).props.onChange(true);});expect(botao().props.disabled).toBe(true);
 await aceitar();expect(botao().props.disabled).toBe(false);await act(async()=>{await botao().props.onPress();});
 expect(m.post).toHaveBeenCalledWith('/app/apresentacao-crianca',expect.objectContaining({filho:'kids:1',consentimentos_kids:{versao:'v1',imagem:true,genitores:true}}));
});
it('troca de conta limpa autorizações',async()=>{
 await montar();await selecionar();await aceitar();m.user='outra';await act(async()=>{tree!.update(React.createElement(Tela));});await selecionar();
 expect(botao().props.disabled).toBe(true);expect(tree!.root.findByProps({label:'Genitores'}).props.checked).toBe(false);
});
it.each(['Inscrever uma criança ainda não cadastrada','É filho de outra pessoa'])('manual exige autorizações: %s',async(label)=>{
 await montar();const option=tree!.root.findAllByType('Pressable' as any).find(n=>n.findAllByType('Text' as any).some(t=>t.props.children===label))!;
 await act(async()=>{option.props.onPress();});expect(botao().props.disabled).toBe(true);await act(async()=>{await botao().props.onPress();});expect(m.post).not.toHaveBeenCalled();
 expect(tree!.root.findByProps({label:'Genitores'}).props.checked).toBe(false);
});
it.each(['Inscrever uma criança ainda não cadastrada','É filho de outra pessoa'])('manual completo envia e editar identidade revoga aceites: %s',async(label)=>{
 await montar();const option=tree!.root.findAllByType('Pressable' as any).find(n=>n.findAllByType('Text' as any).some(t=>t.props.children===label))!;
 await act(async()=>{option.props.onPress();});
 await act(async()=>{
  tree!.root.findByProps({label:'Nome completo da criança'}).props.onChangeText('Criança Manual');
  tree!.root.findByProps({label:'Data de nascimento'}).props.onChangeText('10/03/2020');
  if(label==='É filho de outra pessoa'){
   tree!.root.findByProps({label:'Nome completo do responsável'}).props.onChangeText('Responsável Legal');
   tree!.root.findByProps({label:'Telefone do responsável'}).props.onChangeText('21999998888');
  }
 });
 expect(botao().props.disabled).toBe(true);await aceitar();expect(botao().props.disabled).toBe(false);
 await act(async()=>{tree!.root.findByProps({label:'Nome completo da criança'}).props.onChangeText('Outra Criança');});
 expect(botao().props.disabled).toBe(true);expect(tree!.root.findByProps({label:'Genitores'}).props.checked).toBe(false);
 await aceitar();await act(async()=>{await botao().props.onPress();});
 expect(m.post).toHaveBeenCalledWith('/app/apresentacao-crianca',expect.objectContaining({propria:label!=='É filho de outra pessoa',consentimentos_kids:{versao:'v1',imagem:true,genitores:true}}));
});
