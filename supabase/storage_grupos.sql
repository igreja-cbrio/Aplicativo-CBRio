-- Bucket "grupos" — fotos de capa dos grupos pequenos (mem_grupos.foto_url).
-- Público para leitura (qualquer um pode ver a foto), upload/replace só para
-- admin/diretor ou líder do grupo. Estrutura: grupos/{grupo_id}.{ext}.
--
-- Rode este SQL UMA VEZ no projeto unificado (hhntwfawfnxvuobhdfkb).

insert into storage.buckets (id, name, public)
values ('grupos', 'grupos', true)
on conflict (id) do nothing;

-- Helper: o usuário atual é admin/diretor?
create or replace function public.is_admin_or_diretor()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and role in ('admin', 'diretor')
  );
$$;

-- Helper: o usuário atual é líder do grupo?
-- Tenta a coluna lider_id em mem_grupos; se a coluna não existir o trecho
-- retorna false sem quebrar.
create or replace function public.is_lider_grupo(p_grupo uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_membro uuid;
  v_is boolean := false;
begin
  select membro_id into v_membro from public.profiles where id = auth.uid();
  if v_membro is null then return false; end if;
  begin
    execute 'select exists(select 1 from public.mem_grupos where id=$1 and lider_id=$2)'
      into v_is using p_grupo, v_membro;
  exception when undefined_column then
    v_is := false;
  end;
  return coalesce(v_is, false);
end;
$$;

-- Leitura pública (o bucket já é public, mas garantimos o SELECT no
-- storage.objects também).
drop policy if exists "grupos: leitura publica" on storage.objects;
create policy "grupos: leitura publica"
  on storage.objects for select
  using (bucket_id = 'grupos');

-- Upload (INSERT): admin/diretor OU líder do grupo (path = grupos/{grupo_id}.*).
drop policy if exists "grupos: upload admin ou lider" on storage.objects;
create policy "grupos: upload admin ou lider"
  on storage.objects for insert
  with check (
    bucket_id = 'grupos'
    and (
      public.is_admin_or_diretor()
      or public.is_lider_grupo(
        nullif(regexp_replace(name, '\..+$', ''), '')::uuid
      )
    )
  );

-- Update (replace): mesmas regras.
drop policy if exists "grupos: update admin ou lider" on storage.objects;
create policy "grupos: update admin ou lider"
  on storage.objects for update
  using (
    bucket_id = 'grupos'
    and (
      public.is_admin_or_diretor()
      or public.is_lider_grupo(
        nullif(regexp_replace(name, '\..+$', ''), '')::uuid
      )
    )
  );

-- Delete: só admin/diretor (líder não apaga capa, só substitui).
drop policy if exists "grupos: delete admin" on storage.objects;
create policy "grupos: delete admin"
  on storage.objects for delete
  using (bucket_id = 'grupos' and public.is_admin_or_diretor());
