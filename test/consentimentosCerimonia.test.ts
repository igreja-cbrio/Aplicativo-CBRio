import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { beforeEach, afterEach, it, expect, vi } from 'vitest';
const m=vi.hoisted(()=>({get:vi.fn()}));
vi.mock('react-native',()=>({View:'View'}));
vi.mock('@/lib/api',()=>({apiGet:m.get}));
vi.mock('@/lib/i18n',()=>({useT:()=>((s:string)=>s)}));
vi.mock('@/components/ui/Typography',()=>({Text:'Text'}));
vi.mock('@/components/ui/Checkbox',()=>({Checkbox:'Checkbox'}));
vi.mock('@/components/ui/Button',()=>({Button:'Button'}));
import { useConsentimentosCerimonia } from '../components/kids/ConsentimentosCerimonia';
let tree:ReactTestRenderer|undefined;
let c:ReturnType<typeof useConsentimentosCerimonia>;
function Host({id='a',atividade='batismo'}:{id?:string;atividade?:'batismo'|'apresentacao'}){c=useConsentimentosCerimonia(atividade,id);return null;}
const termos={versao:'v1',imagem:'Imagem',genitores:'Genitores',aviso:'Aviso'};
beforeEach(()=>{(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;vi.resetAllMocks();m.get.mockResolvedValue(termos);});
afterEach(async()=>{if(tree)await act(async()=>tree!.unmount());tree=undefined;});
async function montar(atividade:'batismo'|'apresentacao'='batismo'){await act(async()=>{tree=create(React.createElement(Host,{atividade}));});}
async function aceitar(){await act(async()=>{c.mudar('imagem',true);c.mudar('genitores',true);});}
it.each(['batismo','apresentacao'] as const)('exige ambos e versão para %s',async(atividade)=>{
 await montar(atividade);expect(m.get).toHaveBeenCalledWith(`/app/kids/inscricoes/termos?atividade=${atividade}`);
 expect(c!.payload).toBeNull();await act(async()=>{c.mudar('imagem',true);});expect(c!.pronto).toBe(false);
 await aceitar();expect(c!.payload).toEqual({versao:'v1',imagem:true,genitores:true});
 await act(async()=>{c.mudar('imagem',false);});expect(c!.payload).toBeNull();
});
it('reseta quando identidade ou modalidade muda',async()=>{
 await montar();await aceitar();await act(async()=>{tree!.update(React.createElement(Host,{id:'outra-crianca'}));});
 expect(c!.imagem).toBe(false);expect(c!.genitores).toBe(false);await aceitar();
 await act(async()=>{tree!.update(React.createElement(Host,{id:'terceiros'}));});expect(c!.pronto).toBe(false);
});
it('falha ou contrato incompleto impede envio e permite repetir',async()=>{
 m.get.mockRejectedValueOnce(new Error('rede'));await montar();expect(c!.erro).toBe(true);expect(c!.payload).toBeNull();
 await act(async()=>{await c.carregar();});await aceitar();expect(c!.pronto).toBe(true);
 m.get.mockResolvedValueOnce({...termos,versao:''});await act(async()=>{await c.carregar();});expect(c!.erro).toBe(true);expect(c!.payload).toBeNull();
});
it('409 recarrega termos e exige nova leitura; erro comum preserva aceites',async()=>{
 await montar();await aceitar();expect(c!.tratarErro({status:500})).toBe(false);expect(c!.pronto).toBe(true);
 m.get.mockResolvedValueOnce({...termos,versao:'v2'});await act(async()=>{expect(c.tratarErro({status:409,corpo:{codigo:'termos_kids_desatualizados'}})).toBe(true);});
 expect(c!.termos?.versao).toBe('v2');expect(c!.imagem).toBe(false);expect(c!.genitores).toBe(false);expect(c!.payload).toBeNull();
});
