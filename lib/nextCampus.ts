/** Conteúdo local do NEXT: a ausência de localização nunca usa coordenadas da Sede. */
export function nextLocalizacaoDisponivel(me: {localizacao_configurada?: boolean; igreja?: {lat:number;lng:number;raio_m:number}|null}|null) {
 const local=me?.igreja;
 return me?.localizacao_configurada!==false && !!local && Number.isFinite(local.lat) && Math.abs(local.lat)<=90 && Number.isFinite(local.lng) && Math.abs(local.lng)<=180 && Number.isFinite(local.raio_m) && local.raio_m>0;
}
export function nextContextoMudou(error: unknown) {
 return (error as {code?:string}|null)?.code==='CAMPUS_CONTEXT_CHANGED';
}
export function nextErroExigeLimpeza(error: unknown) {
 const e=error as {status?:number;code?:string;corpo?:{code?:string}}|null;
 const code=e?.corpo?.code||e?.code||'';
 return nextContextoMudou(error)||e?.status===401||e?.status===403||code.startsWith('campus_')||code==='next_identidade_pendente';
}
