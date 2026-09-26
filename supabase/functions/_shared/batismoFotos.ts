// Handler testável: apenas o backend autenticado pode anunciar um álbum local.
type Deps={db:any;secret:string|undefined;notify:(target:{membroIds:string[]},payload:any)=>Promise<unknown>};
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}});
export function criarNotificadorFotos({db,secret,notify}:Deps) {
 return async(req:Request)=>{
  if(req.method!=='POST') return json({error:'Método não permitido.'},405);
  if(!secret || req.headers.get('authorization')!==`Bearer ${secret}`) return json({error:'Acesso não autorizado.'},401);
  let chave:string|null=null;
  try {
   const {campus_id,evento_id}=await req.json();
   if(!UUID.test(campus_id||'') || !UUID.test(evento_id||'')) return json({error:'Informe campus e evento válidos.'},400);
   const {data:evento,error:eventError}=await db.from('batismo_eventos').select('id').eq('id',evento_id).eq('igreja_id',campus_id).maybeSingle();
   if(eventError) throw eventError;if(!evento) return json({error:'Evento não encontrado.'},404);
   const membros=new Set<string>();
   for(let offset=0;;offset+=1000) {
    const {data,error}=await db.from('batismo_inscricoes').select('membro_id').eq('igreja_id',campus_id).eq('evento_id',evento_id)
      .is('deleted_at',null).not('status','in','(cancelado,rejeitado)').not('membro_id','is',null).order('id').range(offset,offset+999);
    if(error||!Array.isArray(data)) throw error||new Error('Inscrições indisponíveis.');
    data.forEach((i:{membro_id:string})=>membros.add(i.membro_id));if(data.length<1000) break;
   }
   if(!membros.size) return json({ok:true,sem_batizados:true});
   const dedupKey=`batismo-fotos:${campus_id}:${evento_id}`;
   const {data:dedup,error:dedupError}=await db.from('app_lembretes_enviados').upsert({chave:dedupKey},{onConflict:'chave',ignoreDuplicates:true}).select('chave');
   if(dedupError) throw dedupError;if(!dedup?.length){chave=null;return json({ok:true,ja_avisado:true});}
   chave=dedupKey;
   await notify({membroIds:[...membros]}, {tipo:'batismo',titulo:'As fotos do seu batismo chegaram!',body:'Veja o álbum do seu batismo no app.',data:{campus_id,evento_id}});
   chave=null;return json({ok:true,avisados:membros.size});
  } catch {
   if(chave) await db.from('app_lembretes_enviados').delete().eq('chave',chave);
   return json({ok:false,error:'Não foi possível anunciar o álbum.'},503);
  }
 };
}
