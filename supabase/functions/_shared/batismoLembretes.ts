type Deps={db:any;notify:(target:{membroIds:string[]},payload:any)=>Promise<unknown>};
async function paginas(query:()=>any) {
 const rows:any[]=[];
 for(let offset=0;;offset+=1000){const {data,error}=await query().range(offset,offset+999);if(error||!Array.isArray(data))throw error||new Error('Lembretes indisponíveis.');rows.push(...data);if(data.length<1000)return rows;}
}
/** Cada ato local define seu destinatário e destino; a data não é identidade do evento. */
export async function enviarLembretesBatismo({db,notify}:Deps,hoje:string,minutos:number) {
 const amanha=new Date(`${hoje}T12:00:00Z`);amanha.setUTCDate(amanha.getUTCDate()+1);
 const casos=[
  {quando:amanha.toISOString().slice(0,10),inicio:1080,chave:'batismo-vespera',titulo:'Amanhã é o seu batismo!',body:'Chegue 30 minutos antes, leve roupa de banho e toalha. Estamos te esperando!'},
  {quando:hoje,inicio:480,chave:'batismo-dia',titulo:'Hoje é o grande dia!',body:'Seu batismo é hoje. Não esqueça a toalha e faça o check-in no app quando chegar.'},
 ];
 for(const caso of casos){
  if(minutos<caso.inicio||minutos>caso.inicio+9)continue;
  const eventos=await paginas(()=>db.from('batismo_eventos').select('id,igreja_id').eq('data',caso.quando).order('id'));
  for(const evento of eventos){
   if(!evento.id||!evento.igreja_id)throw new Error('Evento sem campus confirmado.');
   const inscricoes=await paginas(()=>db.from('batismo_inscricoes').select('membro_id').eq('igreja_id',evento.igreja_id).eq('evento_id',evento.id).eq('data_batismo',caso.quando).is('deleted_at',null).in('status',['pendente','confirmado']).not('membro_id','is',null).order('id'));
   for(const membroId of new Set<string>(inscricoes.map(i=>i.membro_id))){
    const chave=`${caso.chave}:${evento.igreja_id}:${evento.id}:${caso.quando}:${membroId}`;
    const {data,error}=await db.from('app_lembretes_enviados').upsert({chave},{onConflict:'chave',ignoreDuplicates:true}).select('chave');
    if(error)throw error;if(!data?.length)continue;
    try {await notify({membroIds:[membroId]},{tipo:'batismo',titulo:caso.titulo,body:caso.body,data:{campus_id:evento.igreja_id,evento_id:evento.id}});}
    catch(error){await db.from('app_lembretes_enviados').delete().eq('chave',chave);throw error;}
   }
  }
 }
}

export function autorizarCronLembretes(req:Request,segredo:string|undefined): Response|null {
 if(req.method!=='POST')return new Response(null,{status:405});
 if(!segredo||req.headers.get('authorization')!==`Bearer ${segredo}`)return new Response(null,{status:401});
 return null;
}
