import {describe,it,expect,vi} from 'vitest';
import {enviarLembretesBatismo,autorizarCronLembretes} from '../supabase/functions/_shared/batismoLembretes';
const A='00000000-0000-0000-0000-000000000001',B='00000000-0000-0000-0000-000000000002',E='10000000-0000-0000-0000-000000000001',F='10000000-0000-0000-0000-000000000002';
function banco(){
 const claims=new Set<string>(),calls:any[]=[];
 const rows:any={batismo_eventos:[{id:E,igreja_id:A,data:'2099-09-27'},{id:F,igreja_id:B,data:'2099-09-27'}],batismo_inscricoes:[{id:A,membro_id:A,igreja_id:A,evento_id:E,data_batismo:'2099-09-27',status:'confirmado',deleted_at:null},{id:B,membro_id:A,igreja_id:B,evento_id:F,data_batismo:'2099-09-27',status:'pendente',deleted_at:null},{id:E,membro_id:B,igreja_id:A,evento_id:E,data_batismo:'2099-09-27',status:'cancelado',deleted_at:null},{id:F,membro_id:B,igreja_id:A,evento_id:E,data_batismo:'2099-09-27',status:'confirmado',deleted_at:'2099-01-01'}]};
 const db:any={claims,calls,rows,fail:false,from:(table:string)=>{const c:any={table,filters:[],write:null,remove:false};calls.push(c);const q:any={};for(const op of ['select','order','range'])q[op]=()=>q;for(const op of ['eq','is','not','in'])q[op]=(...args:any[])=>{c.filters.push([op,...args]);return q;};q.upsert=(v:any)=>{c.write=v;return q;};q.delete=()=>{c.remove=true;return q;};q.then=(ok:any,no:any)=>{let data:any=[];if(table==='app_lembretes_enviados'){if(c.remove)claims.delete(c.filters[0][2]);else if(!claims.has(c.write.chave)){claims.add(c.write.chave);data=[c.write];}}else data=(rows[table]||[]).filter((r:any)=>c.filters.every(([op,k,v]:any[])=>op==='not'?r[k]!==null:op==='in'?v.includes(r[k]):r[k]===v));return Promise.resolve({data,error:db.fail?new Error('offline'):null}).then(ok,no);};return q;}};return db;
}
describe('lembrete por ato local',()=>{
 it('mesma data e pessoa em dois campi preservam dois eventos sem incluir cancelados ou excluídos',async()=>{const db=banco(),notify=vi.fn();await enviarLembretesBatismo({db,notify},'2099-09-26',1080);expect(notify).toHaveBeenCalledTimes(2);expect(notify).toHaveBeenNthCalledWith(1,{membroIds:[A]},expect.objectContaining({data:{campus_id:A,evento_id:E}}));expect(notify).toHaveBeenNthCalledWith(2,{membroIds:[A]},expect.objectContaining({data:{campus_id:B,evento_id:F}}));expect(db.claims.size).toBe(2);await enviarLembretesBatismo({db,notify},'2099-09-26',1081);expect(notify).toHaveBeenCalledTimes(2);});
 it('fora da janela não consulta dados nem dispara mensagens',async()=>{const db=banco(),notify=vi.fn();await enviarLembretesBatismo({db,notify},'2099-09-26',600);expect(db.calls).toHaveLength(0);expect(notify).not.toHaveBeenCalled();});
 it('falha de consulta não envia lista parcial',async()=>{const db=banco(),notify=vi.fn();db.fail=true;await expect(enviarLembretesBatismo({db,notify},'2099-09-26',1080)).rejects.toThrow();expect(notify).not.toHaveBeenCalled();expect(db.claims.size).toBe(0);});
 it('falha de envio libera somente claim próprio para nova tentativa',async()=>{const db=banco(),notify=vi.fn().mockRejectedValueOnce(new Error('offline'));await expect(enviarLembretesBatismo({db,notify},'2099-09-27',480)).rejects.toThrow();expect(db.claims.size).toBe(0);await enviarLembretesBatismo({db,notify},'2099-09-27',481);expect(db.claims.size).toBe(2);});
});

it('cron requer service role explícita e recusa anon, ausência e outro método',()=>{
 const req=(method:string,token?:string)=>new Request('https://test.local',{method,headers:token?{authorization:`Bearer ${token}`}:{}});
 expect(autorizarCronLembretes(req('POST','segredo'),'segredo')).toBeNull();
 for(const token of [undefined,'anon','usuario'])expect(autorizarCronLembretes(req('POST',token),'segredo')?.status).toBe(401);
 expect(autorizarCronLembretes(req('GET','segredo'),'segredo')?.status).toBe(405);
 expect(autorizarCronLembretes(req('POST','segredo'),undefined)?.status).toBe(401);
});
