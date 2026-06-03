-- ============================================================
-- CBRio — Tokens de push (Expo). Rodar no projeto do SISTEMA.
-- O app grava o token aqui; a Edge Function notify-escala envia o push.
-- ============================================================
create table if not exists public.app_push_tokens (
  token text primary key,
  user_id uuid references auth.users (id) on delete cascade,
  membro_id uuid,
  platform text,
  updated_at timestamptz not null default now()
);

create index if not exists app_push_tokens_membro_idx on public.app_push_tokens (membro_id);

alter table public.app_push_tokens enable row level security;

-- Cada usuário gerencia apenas os próprios tokens
drop policy if exists "push_tokens_proprio" on public.app_push_tokens;
create policy "push_tokens_proprio"
  on public.app_push_tokens for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- service_role (Edge Function) acessa tudo
drop policy if exists "push_tokens_service" on public.app_push_tokens;
create policy "push_tokens_service"
  on public.app_push_tokens for all
  to service_role
  using (true) with check (true);
