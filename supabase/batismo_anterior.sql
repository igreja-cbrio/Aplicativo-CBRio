-- ============================================================
-- CBRio — Marca se o membro já foi batizado em outra igreja.
-- Não impede a inscrição na CBRio; é só registro pra equipe saber.
-- ============================================================

do $$ begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='mem_membros' and column_name='batizado_outra_igreja'
  ) then
    alter table public.mem_membros add column batizado_outra_igreja boolean default false;
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='mem_membros' and column_name='igreja_batismo_anterior'
  ) then
    alter table public.mem_membros add column igreja_batismo_anterior text;
  end if;
end $$;

-- RPC pra o membro marcar via app (RLS friendly).
create or replace function public.app_marcar_batizado_outra(p_igreja text)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_membro uuid;
begin
  select membro_id into v_membro from public.profiles where id = auth.uid();
  if v_membro is null then
    return jsonb_build_object('ok', false, 'erro', 'Perfil sem vínculo de membro.');
  end if;
  update public.mem_membros
    set batizado_outra_igreja = true,
        igreja_batismo_anterior = nullif(trim(coalesce(p_igreja, '')), '')
    where id = v_membro;
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.app_desmarcar_batizado_outra()
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_membro uuid;
begin
  select membro_id into v_membro from public.profiles where id = auth.uid();
  if v_membro is null then
    return jsonb_build_object('ok', false, 'erro', 'Perfil sem vínculo de membro.');
  end if;
  update public.mem_membros
    set batizado_outra_igreja = false,
        igreja_batismo_anterior = null
    where id = v_membro;
  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.app_marcar_batizado_outra(text) to authenticated;
grant execute on function public.app_desmarcar_batizado_outra() to authenticated;
