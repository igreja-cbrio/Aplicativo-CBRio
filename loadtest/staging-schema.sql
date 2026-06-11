-- Schema mínimo-funcional p/ teste de carga do app CBRio (staging isolado).
-- Cobre as tabelas/colunas que o fluxo do app consulta, com RLS e o trigger
-- handle_new_user (cria profile + mem_membros no signup). NÃO é o schema
-- completo do ERP — só o necessário pra exercitar o padrão de acesso sob carga.

-- ── tabelas de referência ──────────────────────────────────────────
create table if not exists public.vol_service_types (
  id uuid primary key default gen_random_uuid(),
  name text,
  color text,
  has_online_stream boolean default false,
  has_kids boolean default false
);

create table if not exists public.cultos (
  id uuid primary key default gen_random_uuid(),
  nome text,
  data date not null,
  hora time not null,
  service_type_id uuid references public.vol_service_types(id),
  youtube_video_id text,
  deleted_at timestamptz,
  created_at timestamptz default now()
);
create index if not exists idx_cultos_data on public.cultos(data) where deleted_at is null;

create table if not exists public.app_destaques (
  id uuid primary key default gen_random_uuid(),
  titulo text,
  subtitulo text,
  imagem_url text not null,
  link text,
  ordem int default 0
);

-- ── membro ─────────────────────────────────────────────────────────
create table if not exists public.mem_membros (
  id uuid primary key default gen_random_uuid(),
  nome text,
  cpf text,
  email text,
  telefone text,
  data_nascimento date,
  status text default 'visitante',
  voluntario boolean default false,
  foto_url text,
  deleted_at timestamptz,
  created_at timestamptz default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text,
  email text,
  telefone text,
  avatar_url text,
  role text default 'assistente',
  is_membro_only boolean default true,
  membro_id uuid references public.mem_membros(id),
  created_at timestamptz default now()
);
create index if not exists idx_profiles_membro on public.profiles(membro_id);

create table if not exists public.vol_inscricoes (
  id uuid primary key default gen_random_uuid(),
  membro_id uuid references public.mem_membros(id),
  status text default 'pendente',
  area text,
  ministerios_interesse text[],
  integrado_em timestamptz,
  created_at timestamptz default now()
);
create index if not exists idx_vol_insc_membro on public.vol_inscricoes(membro_id);

create table if not exists public.app_notificacoes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  tipo text default 'geral',
  titulo text,
  body text,
  data jsonb default '{}'::jsonb,
  lida_em timestamptz,
  criada_em timestamptz default now()
);
create index if not exists idx_notif_user on public.app_notificacoes(user_id);
create index if not exists idx_notif_user_naolida on public.app_notificacoes(user_id) where lida_em is null;

-- ── trigger: cria profile + membro no signup ───────────────────────
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare new_membro uuid;
begin
  insert into public.mem_membros (nome, email, telefone, status, voluntario)
  values (coalesce(new.raw_user_meta_data->>'nome', new.email), new.email,
          new.raw_user_meta_data->>'telefone', 'visitante',
          (random() < 0.3))           -- ~30% voluntários, p/ exercitar o ramo
  returning id into new_membro;

  insert into public.profiles (id, name, email, telefone, membro_id, role, is_membro_only)
  values (new.id, coalesce(new.raw_user_meta_data->>'nome', new.email), new.email,
          new.raw_user_meta_data->>'telefone', new_membro, 'assistente', true);
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── RLS (espelha o padrão do app: cada um lê o que é seu) ───────────
alter table public.profiles enable row level security;
alter table public.mem_membros enable row level security;
alter table public.app_notificacoes enable row level security;
alter table public.vol_inscricoes enable row level security;
alter table public.cultos enable row level security;
alter table public.vol_service_types enable row level security;
alter table public.app_destaques enable row level security;

drop policy if exists p_profiles_sel on public.profiles;
create policy p_profiles_sel on public.profiles for select to authenticated
  using (id = auth.uid());

drop policy if exists p_membros_sel on public.mem_membros;
create policy p_membros_sel on public.mem_membros for select to authenticated
  using (id in (select membro_id from public.profiles where id = auth.uid()));

drop policy if exists p_notif_sel on public.app_notificacoes;
create policy p_notif_sel on public.app_notificacoes for select to authenticated
  using (user_id = auth.uid());
drop policy if exists p_notif_upd on public.app_notificacoes;
create policy p_notif_upd on public.app_notificacoes for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists p_vol_sel on public.vol_inscricoes;
create policy p_vol_sel on public.vol_inscricoes for select to authenticated
  using (membro_id in (select membro_id from public.profiles where id = auth.uid()));

drop policy if exists p_cultos_sel on public.cultos;
create policy p_cultos_sel on public.cultos for select to authenticated using (true);
drop policy if exists p_st_sel on public.vol_service_types;
create policy p_st_sel on public.vol_service_types for select to authenticated using (true);
drop policy if exists p_destaques_sel on public.app_destaques;
create policy p_destaques_sel on public.app_destaques for select to authenticated using (true);
