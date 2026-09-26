import {describe,it,expect,vi} from 'vitest';
import {destinoBatismo,eventoDoBatismo} from '../lib/batismoDestino';
import {criarNotificadorFotos} from '../supabase/functions/_shared/batismoFotos';
const A='00000000-0000-0000-0000-000000000001',B='00000000-0000-0000-0000-000000000002',E='10000000-0000-0000-0000-000000000001';
function banco(){
 const calls:any[]=[],claims=new Set<string>();
 const rows:any={batismo_eventos:[{id:E,igreja_id:B}],batismo_inscricoes:[{id:A,membro_id:A,igreja_id:B,evento_id:E,status:'realizado',deleted_at:null},{id:B,membro_id:B,igreja_id:A,evento_id:E,status:'realizado',deleted_at:null}]};
 const db:any={calls,claims,from:(table:string)=>{const c:any={table,filters:[],write:null,single:false,remove:false};calls.push(c);const q:any={};
  for(const op of ['select','order','range'])q[op]=()=>q;
  for(const op of ['eq','is','not'])q[op]=(...args:any[])=>{c.filters.push([op,...args]);return q;};
  q.maybeSingle=()=>{c.single=true;return q;};q.upsert=(v:any)=>{c.write=v;return q;};q.delete=()=>{c.remove=true;return q;};
  q.then=(ok:any,no:any)=>{let data:any=[];
   if(table==='app_lembretes_enviados') {
    if(c.remove){claims.delete(c.filters[0][2]);}
    else if(!claims.has(c.write.chave)){claims.add(c.write.chave);data=[c.write];}
   }else {data=(rows[table]||[]).filter((r:any)=>c.filters.every(([op,k,v]:any[])=>op==='not'?true:r[k]===v));if(c.single)data=data[0]||null;}
   return Promise.resolve({data,error:null}).then(ok,no);
  };return q;
 }};return db;
}
function req(body:unknown,secret='segredo'){return new Request('https://test.local',{method:'POST',headers:{Authorization:`Bearer ${secret}`,'Content-Type':'application/json'},body:JSON.stringify(body)});}
describe('notificação de álbum local protegida',()=>{
 it('rejeita cliente sem service role antes de consultar o banco',async()=>{
  const db=banco(),notify=vi.fn(),h=criarNotificadorFotos({db,secret:'segredo',notify});
  expect((await h(req({campus_id:B,evento_id:E},'anon'))).status).toBe(401);expect(db.calls).toHaveLength(0);expect(notify).not.toHaveBeenCalled();
 });
 it('exige IDs; data sozinha não dispara fan-out global',async()=>{
  const db=banco(),notify=vi.fn(),h=criarNotificadorFotos({db,secret:'segredo',notify});
  expect((await h(req({data:'2026-09-27'}))).status).toBe(400);expect(notify).not.toHaveBeenCalled();
 });
 it('notifica somente membros do evento/campus e deduplica por ambos',async()=>{
  const db=banco(),notify=vi.fn().mockResolvedValue({}),h=criarNotificadorFotos({db,secret:'segredo',notify});
  expect((await h(req({campus_id:B,evento_id:E}))).status).toBe(200);
  expect(notify).toHaveBeenCalledWith({membroIds:[A]},expect.objectContaining({data:{campus_id:B,evento_id:E}}));
  await h(req({campus_id:B,evento_id:E}));expect(notify).toHaveBeenCalledTimes(1);
  expect([...db.claims]).toEqual([`batismo-fotos:${B}:${E}`]);
 });
 it('falha de envio libera a própria tentativa para retry',async()=>{
  const db=banco(),notify=vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue({}),h=criarNotificadorFotos({db,secret:'segredo',notify});
  expect((await h(req({campus_id:B,evento_id:E}))).status).toBe(503);expect(db.claims.size).toBe(0);
  expect((await h(req({campus_id:B,evento_id:E}))).status).toBe(200);expect(notify).toHaveBeenCalledTimes(2);
 });
});


it('destino de álbum carrega evento válido e nunca aceita IDs ambíguos',()=>{
 expect(destinoBatismo({evento_id:E})).toEqual({pathname:'/batismo',params:{evento_id:E}});
 expect(eventoDoBatismo({evento_id:[E,A]})).toBeNull();expect(eventoDoBatismo({evento_id:'../outro'})).toBeNull();
});
