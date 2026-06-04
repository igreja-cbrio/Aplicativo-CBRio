-- ============================================================
-- CBRio — Banners de destaque (carrossel da home).
-- Marketing posta aqui; o app puxa publicamente (sem auth).
-- ============================================================

create table if not exists public.app_destaques (
  id uuid primary key default gen_random_uuid(),
  titulo text,
  subtitulo text,
  imagem_url text not null,
  link text,                          -- URL externa OU deeplink interno (ex.: /grupos)
  ordem int not null default 100,
  ativo boolean not null default true,
  publica_em timestamptz default now(),
  expira_em timestamptz,
  criada_em timestamptz not null default now(),
  atualizada_em timestamptz not null default now()
);

create index if not exists app_destaques_ativos_idx
  on public.app_destaques (ordem, publica_em)
  where ativo = true;

alter table public.app_destaques enable row level security;

-- Leitura pública dos destaques vigentes (ativos + dentro da janela).
drop policy if exists "destaques_publicos" on public.app_destaques;
create policy "destaques_publicos"
  on public.app_destaques for select
  using (
    ativo = true
    and (publica_em is null or publica_em <= now())
    and (expira_em is null or expira_em > now())
  );

-- Admin/diretor faz tudo.
drop policy if exists "destaques_admin" on public.app_destaques;
create policy "destaques_admin"
  on public.app_destaques for all
  using (exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('admin','diretor')
  ))
  with check (exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('admin','diretor')
  ));

-- service_role acessa tudo.
drop policy if exists "destaques_service" on public.app_destaques;
create policy "destaques_service"
  on public.app_destaques for all
  to service_role
  using (true) with check (true);
