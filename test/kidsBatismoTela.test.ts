import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { beforeEach, afterEach, it, expect, vi } from 'vitest';
const m=vi.hoisted(()=>({get:vi.fn(),post:vi.fn(),detalhe:vi.fn(),confirmar:vi.fn(),user:'pai'}));
vi.mock('react-native',()=>({View:'View',Pressable:'Pressable',StyleSheet:{create:(s:any)=>s}}));
vi.mock('@/contexts/AuthContext',()=>({useAuth:()=>({user:{id:m.user}})}));
vi.mock('@/contexts/ThemeContext',()=>({useColors:()=>({surface:'white',border:'gray',text:'black'})}));
vi.mock('@/lib/i18n',()=>({useT:()=>((s:string)=>s)}));
vi.mock('@/components/ui/Typography',()=>({Text:'Text'}));
vi.mock('@/components/ui/Input',()=>({Input:'Input'}));
vi.mock('@/components/ui/Button',()=>({Button:'Button'}));
vi.mock('@/components/ui/Checkbox',()=>({Checkbox:'Checkbox'}));
vi.mock('@/components/inscricoes/FormScaffold',()=>({FormScaffold:'FormScaffold'}));
vi.mock('@/components/ui/Dialogo',()=>({useDialogo:()=>({confirmar:m.confirmar,Dialogo:()=>null})}));
vi.mock('@/components/kids/FilhosInscricao',()=>({FilhosInscricao:'FilhosInscricao',useFilhosInscricao:()=>({dados:{responsavel:{telefone:'21999998888',email:'pai@example.test'}},carregando:false,erro:false})}));
vi.mock('@/lib/api',()=>({apiGet:m.get,apiPost:m.post}));
vi.mock('@/lib/kidsFilhosInscricao',()=>({detalheFilhoInscricao:m.detalhe,nascimentoBR:(s:string)=>s?s.split('-').reverse().join('/'):''}));
import Tela from '../app/(app)/kids-batismo';
let tree:ReactTestRenderer|undefined;
const flush=async()=>{for(let i=0;i<8;i++)await Promise.resolve();};
const filho={chave:'kids:1',nome:'Criança Exemplo',data_nascimento:'2020-03-10',sexo:'M',saude:{tem_limitacao_fisica:false},batismo:{cpf:'52998224725',telefone:'21999998888',email:'pai@example.test'}};
beforeEach(()=>{(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;vi.clearAllMocks();m.user='pai';m.get.mockImplementation((p:string)=>Promise.resolve(p.endsWith('horarios')?{datas:[{data_batismo:'2026-12-27',horarios:[{horario:'09:30',label:'09:30'}]}]}:{termos_lgpd:'Termos',imagem:'Imagem',aviso_optin:'WhatsApp'}));m.detalhe.mockResolvedValue(filho);m.confirmar.mockResolvedValue(true);m.post.mockResolvedValue({ok:true});});
afterEach(async()=>{if(tree)await act(async()=>tree!.unmount());tree=undefined;});
async function montar(){await act(async()=>{tree=create(React.createElement(Tela));await flush();});}
async function selecionar(){await act(async()=>{tree!.root.findByType('FilhosInscricao' as any).props.escolher('kids:1');await flush();});}
it.each([false,true])('seleciona filho e distingue inscrição nova de duplicada (%s)',async(duplicado)=>{
 m.post.mockResolvedValue(duplicado?{ok:true,duplicado:true,mensagem:'A inscrição anterior foi mantida.'}:{ok:true});
 await montar();expect(tree!.root.findByType('FormScaffold' as any).props.submitDisabled).toBe(true);
 await selecionar();expect(tree!.root.findAllByProps({label:'CPF da criança'})).toHaveLength(0);
 expect(tree!.root.findAllByProps({label:'Nome completo da criança'})).toHaveLength(0);
 const radio=(label:string)=>tree!.root.findAllByType('Pressable' as any).find(n=>n.findAllByType('Text' as any).some(t=>t.props.children===label))!;
 await act(async()=>{radio('09:30').props.onPress();radio('P').props.onPress();tree!.root.findByProps({label:'Termos'}).props.onChange(true);});
 await act(async()=>{await tree!.root.findByType('FormScaffold' as any).props.onSubmit();});
 expect(m.post).toHaveBeenCalledWith('/app/kids/inscricoes/batismo',expect.objectContaining({filho:'kids:1',nome_completo:filho.nome,cpf:filho.batismo.cpf,telefone:'21999998888',data_nascimento:filho.data_nascimento,data_batismo:'2026-12-27',horario_culto:'09:30',aceita_termos:true,consent_imagem:false}));
 expect(tree!.root.findByType('FormScaffold' as any).props.enviado).toBe(!duplicado);
 if(duplicado) expect(tree!.root.findByType('FormScaffold' as any).props.error).toBe('A inscrição anterior foi mantida.');
});
it('troca de conta limpa filho e aceite antes de qualquer nova inscrição',async()=>{
 await montar();await selecionar();await act(async()=>{tree!.root.findByProps({label:'Termos'}).props.onChange(true);});
 m.user='outra-conta';await act(async()=>{tree!.update(React.createElement(Tela));await flush();});
 expect(tree!.root.findAllByType('FilhosInscricao' as any)).toHaveLength(1);
 expect(tree!.root.findByType('FormScaffold' as any).props.submitDisabled).toBe(true);expect(m.post).not.toHaveBeenCalled();
});
it('falha ao carregar detalhe mantém seleção e impede envio',async()=>{
 m.detalhe.mockRejectedValue(new Error('Criança não disponível.'));await montar();await selecionar();
 expect(tree!.root.findByType('FormScaffold' as any).props.error).toBe('Criança não disponível.');
 expect(tree!.root.findByType('FormScaffold' as any).props.submitDisabled).toBe(true);expect(m.post).not.toHaveBeenCalled();
});
