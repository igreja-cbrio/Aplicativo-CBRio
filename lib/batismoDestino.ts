const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function eventoDoBatismo(data:unknown):string|null {
 const id=(data && typeof data==='object' ? (data as {evento_id?:unknown}).evento_id : null);
 return typeof id==='string' && UUID.test(id) ? id : null;
}
export function destinoBatismo(data:unknown) {
 const id=eventoDoBatismo(data);
 return id ? {pathname:'/batismo' as const,params:{evento_id:id}} : {pathname:'/batismo' as const};
}
