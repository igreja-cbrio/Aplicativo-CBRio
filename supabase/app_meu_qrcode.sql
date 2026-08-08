-- ⚠️ CÓPIA DE LEITURA — não é a fonte (marcado em 08/08/2026).
-- Este arquivo documenta um objeto que existe no projeto `hhntwfawfnxvuobhdfkb`,
-- mas quem CRIA e ALTERA esse objeto são as migrations do ERP
-- (`SISTEMA_INTEGRADO_CBRIO/supabase/migrations/`). Rodar daqui pode reverter
-- uma alteração feita lá — confira a migration correspondente antes.

-- ============================================================
-- SISTEMA_INTEGRADO_CBRIO — token de QR do membro p/ o cartão único do app.
-- Retorna o token (mem_qrcodes) do membro do usuário logado; cria se faltar.
-- O QR único (token -> CPF) é o mesmo lido pelos leitores de membresia e de
-- check-in de voluntário (a unificação no leitor é feita no ERP).
-- ============================================================
create or replace function public.app_meu_qrcode()
returns text
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_cpf text;
  v_token text;
begin
  if auth.uid() is null then
    raise exception 'não autenticado';
  end if;

  select m.cpf into v_cpf
  from public.profiles p
  join public.mem_membros m on m.id = p.membro_id
  where p.id = auth.uid();

  if v_cpf is null then
    return null; -- usuário ainda não vinculado a um membro
  end if;

  select token into v_token from public.mem_qrcodes where cpf = v_cpf limit 1;

  if v_token is null then
    v_token := replace(gen_random_uuid()::text, '-', '');
    insert into public.mem_qrcodes (token, cpf, created_at)
    values (v_token, v_cpf, now())
    on conflict (token) do nothing;
  end if;

  return v_token;
end;
$function$;

grant execute on function public.app_meu_qrcode() to authenticated;
