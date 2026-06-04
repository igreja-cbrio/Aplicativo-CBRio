-- ============================================================
-- CBRio — Solicitações de exclusão de conta (soft delete).
-- Usuário escolhe motivo em Configurações; profiles.status vira
-- 'excluido_solicitado' e o sistema processa a desativação real.
-- ============================================================

create table if not exists public.app_solicitacoes_exclusao (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  motivo text not null,
  detalhe text,
  status text not null default 'pendente',  -- pendente | processado | cancelado
  criada_em timestamptz not null default now(),
  processada_em timestamptz
);

create index if not exists app_solic_excl_user_idx
  on public.app_solicitacoes_exclusao (user_id, criada_em desc);

alter table public.app_solicitacoes_exclusao enable row level security;

-- Cada usuário cria/lê só as próprias.
drop policy if exists "solic_excl_insert_propria" on public.app_solicitacoes_exclusao;
create policy "solic_excl_insert_propria"
  on public.app_solicitacoes_exclusao for insert
  with check (auth.uid() = user_id);

drop policy if exists "solic_excl_select_propria" on public.app_solicitacoes_exclusao;
create policy "solic_excl_select_propria"
  on public.app_solicitacoes_exclusao for select
  using (auth.uid() = user_id);

-- service_role e admin/diretor leem tudo.
drop policy if exists "solic_excl_service" on public.app_solicitacoes_exclusao;
create policy "solic_excl_service"
  on public.app_solicitacoes_exclusao for all
  to service_role
  using (true) with check (true);

drop policy if exists "solic_excl_admin_select" on public.app_solicitacoes_exclusao;
create policy "solic_excl_admin_select"
  on public.app_solicitacoes_exclusao for select
  using (exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('admin','diretor')
  ));

-- Garantir coluna profiles.status (idempotente — não quebra se já existir).
do $$ begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='profiles' and column_name='status'
  ) then
    alter table public.profiles add column status text;
  end if;
end $$;
