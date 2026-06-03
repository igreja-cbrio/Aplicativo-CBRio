-- ============================================================
-- CBRio — Tabela de perfis (profiles)
-- Rode este script no Supabase: Dashboard -> SQL Editor -> New query -> Run
-- ============================================================

-- 1) Tabela de perfis (1:1 com auth.users)
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  nome text,
  telefone text,
  email text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2) Row Level Security: cada usuário só acessa o próprio perfil
alter table public.profiles enable row level security;

drop policy if exists "perfil_select_proprio" on public.profiles;
create policy "perfil_select_proprio"
  on public.profiles for select
  using (auth.uid() = id);

drop policy if exists "perfil_update_proprio" on public.profiles;
create policy "perfil_update_proprio"
  on public.profiles for update
  using (auth.uid() = id);

drop policy if exists "perfil_insert_proprio" on public.profiles;
create policy "perfil_insert_proprio"
  on public.profiles for insert
  with check (auth.uid() = id);

-- 3) Mantém updated_at em dia
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- 4) Cria o perfil automaticamente quando um usuário é criado
--    (pega o "nome" enviado no signUp em options.data)
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, nome, telefone, email)
  values (
    new.id,
    new.raw_user_meta_data ->> 'nome',
    new.phone,
    new.email
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
