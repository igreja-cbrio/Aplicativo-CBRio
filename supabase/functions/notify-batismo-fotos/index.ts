// POST campus_id + evento_id; requer service role do backend ERP.
// Nenhuma chamada sem autenticação ou baseada somente em data é aceita.
import {makeAdmin,notificar} from '../_shared/notify.ts';
import {criarNotificadorFotos} from '../_shared/batismoFotos.ts';
Deno.serve(criarNotificadorFotos({db:makeAdmin(),secret:Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),notify:notificar}));
