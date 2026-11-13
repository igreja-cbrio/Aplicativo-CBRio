import { it, expect } from 'vitest';
import { destinoAvisoKids } from '../lib/kidsAvisoDestino';
it('abre o aviso específico e nunca interpreta destinos livres do push',()=>{
 const id='00000000-0000-4000-8000-000000000001';
 expect(destinoAvisoKids({aviso_id:id})).toEqual({pathname:'/kids-mural',params:{aviso:id}});
 for(const value of [null,123,'/perfil','https://example.com',{}]) expect(destinoAvisoKids({aviso_id:value})).toEqual({pathname:'/kids-mural'});
});
