-- ============================================================
-- CBRio — Suporte ao app de batismos:
--   1. Coluna checkin_em em batismo_inscricoes (check-in feito pelo app).
--   2. Bucket de storage 'batismos' para o marketing subir as fotos
--      do dia, organizadas por data (batismos/YYYY-MM-DD/...).
--   3. RPC app_batismo_checkin() que o membro chama no app: só permite
--      se a inscrição é dele, está pendente e a data é hoje.
-- ============================================================

-- 1. coluna checkin_em (idempotente)
do $$ begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='batismo_inscricoes' and column_name='checkin_em'
  ) then
    alter table public.batismo_inscricoes add column checkin_em timestamptz;
  end if;
end $$;

-- 2. bucket 'batismos' (público p/ leitura, marketing sobe via dashboard)
insert into storage.buckets (id, name, public)
values ('batismos', 'batismos', true)
on conflict (id) do nothing;

drop policy if exists "batismos: leitura publica" on storage.objects;
create policy "batismos: leitura publica"
  on storage.objects for select
  using (bucket_id = 'batismos');

drop policy if exists "batismos: upload admin" on storage.objects;
create policy "batismos: upload admin"
  on storage.objects for insert
  with check (
    bucket_id = 'batismos'
    and exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('admin','diretor')
    )
  );

drop policy if exists "batismos: update admin" on storage.objects;
create policy "batismos: update admin"
  on storage.objects for update
  using (
    bucket_id = 'batismos'
    and exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('admin','diretor')
    )
  );

drop policy if exists "batismos: delete admin" on storage.objects;
create policy "batismos: delete admin"
  on storage.objects for delete
  using (
    bucket_id = 'batismos'
    and exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('admin','diretor')
    )
  );

-- 3. RPC de check-in do batismo (membro autenticado).
--    - encontra a inscrição via membro vinculado ao auth.uid()
--    - só permite no dia certo
--    - só permite uma vez (idempotente: se já fez, retorna ok=true)
create or replace function public.app_batismo_checkin(p_inscricao uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_membro uuid;
  v_data date;
  v_status text;
  v_checkin timestamptz;
begin
  select membro_id into v_membro from public.profiles where id = auth.uid();
  if v_membro is null then
    return jsonb_build_object('ok', false, 'erro', 'Perfil sem vínculo de membro.');
  end if;

  select data_batismo, status, checkin_em
    into v_data, v_status, v_checkin
  from public.batismo_inscricoes
  where id = p_inscricao
    and membro_id = v_membro
    and deleted_at is null;

  if not found then
    return jsonb_build_object('ok', false, 'erro', 'Inscrição não encontrada.');
  end if;
  if v_status = 'cancelado' then
    return jsonb_build_object('ok', false, 'erro', 'Esta inscrição foi cancelada.');
  end if;
  if v_data is null then
    return jsonb_build_object('ok', false, 'erro', 'Sua data de batismo ainda não foi marcada.');
  end if;
  if v_data <> current_date then
    return jsonb_build_object('ok', false, 'erro',
      case when v_data > current_date
           then 'O check-in só fica disponível no dia do seu batismo.'
           else 'O dia do seu batismo já passou.'
      end);
  end if;
  if v_checkin is not null then
    return jsonb_build_object('ok', true, 'ja_checkado', true, 'checkin_em', v_checkin);
  end if;

  update public.batismo_inscricoes
    set checkin_em = now()
    where id = p_inscricao
  returning checkin_em into v_checkin;

  return jsonb_build_object('ok', true, 'checkin_em', v_checkin);
end;
$$;

grant execute on function public.app_batismo_checkin(uuid) to authenticated;
