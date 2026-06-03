-- ============================================================
-- SISTEMA_INTEGRADO_CBRIO — handle_new_user() ciente de MEMBRO
-- Aplicar no projeto do sistema (hhntwfawfnxvuobhdfkb), revisado pelo time.
--
-- Mantém o fluxo de FUNCIONÁRIO (rh_funcionarios -> profiles role 'assistente').
-- Para quem NÃO é funcionário (cadastro pelo app), cria/linka MEMBRO:
--   - mem_membros (status 'visitante', origem_cadastro 'app')
--   - profiles (role 'assistente' + is_membro_only = true + membro_id)
--   - role 'membro' NÃO existe (constraint); o gate de membro é is_membro_only.
--   - se já existir membro por CPF/e-mail, apenas vincula (não duplica).
-- Metadados lidos do signup: nome, cpf, telefone, data_nascimento.
-- ============================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  rh_area text;
  rh_cargo text;
  is_staff boolean := false;
  v_membro_id uuid;
  v_cpf text := nullif(new.raw_user_meta_data->>'cpf', '');
  v_nome text := coalesce(
    new.raw_user_meta_data->>'nome',
    new.raw_user_meta_data->>'full_name',
    split_part(new.email, '@', 1)
  );
begin
  select area, cargo into rh_area, rh_cargo
  from rh_funcionarios
  where email = new.email and status = 'ativo'
  limit 1;
  is_staff := found;

  if is_staff then
    -- Funcionário (comportamento original)
    insert into public.profiles (id, name, email, role, area)
    values (new.id, v_nome, new.email, 'assistente', rh_area)
    on conflict (id) do update set area = coalesce(excluded.area, profiles.area);
  else
    -- Membro (cadastro pelo app): evita duplicar
    select id into v_membro_id
    from public.mem_membros
    where deleted_at is null
      and ((v_cpf is not null and cpf = v_cpf) or email = new.email)
    limit 1;

    if v_membro_id is null then
      insert into public.mem_membros
        (id, nome, cpf, email, telefone, data_nascimento,
         status, active, quer_servir, origem_cadastro, created_at, updated_at)
      values (
        gen_random_uuid(),
        v_nome,
        v_cpf,
        new.email,
        nullif(new.raw_user_meta_data->>'telefone', ''),
        nullif(new.raw_user_meta_data->>'data_nascimento', '')::date,
        'visitante',
        true,
        false,
        'app',
        now(),
        now()
      )
      returning id into v_membro_id;
    end if;

    insert into public.profiles (id, name, email, role, is_membro_only, membro_id)
    values (new.id, v_nome, new.email, 'assistente', true, v_membro_id)
    on conflict (id) do update
      set is_membro_only = true,
          membro_id = coalesce(profiles.membro_id, excluded.membro_id);
  end if;

  return new;
end;
$function$;
