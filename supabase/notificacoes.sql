-- ============================================================
-- CBRio — Histórico de notificações in-app.
-- Toda push enviada pelas Edge Functions também é gravada aqui pra
-- aparecer numa tela "Notificações" do app, com contador de não-lidas.
-- ============================================================

create table if not exists public.app_notificacoes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  tipo text not null,                 -- 'escala' | 'sos' | 'grupo_pedido' | ...
  titulo text not null,
  body text not null,
  data jsonb not null default '{}'::jsonb,   -- payload (ids, deeplink, etc.)
  lida_em timestamptz,
  criada_em timestamptz not null default now()
);

create index if not exists app_notificacoes_user_idx
  on public.app_notificacoes (user_id, criada_em desc);

create index if not exists app_notificacoes_user_naolida_idx
  on public.app_notificacoes (user_id) where lida_em is null;

alter table public.app_notificacoes enable row level security;

-- Cada usuário vê só as próprias.
drop policy if exists "notif_propria_select" on public.app_notificacoes;
create policy "notif_propria_select"
  on public.app_notificacoes for select
  using (auth.uid() = user_id);

-- O usuário só pode marcar como lida (update do campo lida_em).
drop policy if exists "notif_propria_marcar_lida" on public.app_notificacoes;
create policy "notif_propria_marcar_lida"
  on public.app_notificacoes for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- service_role (Edge Function) insere/atualiza tudo.
drop policy if exists "notif_service" on public.app_notificacoes;
create policy "notif_service"
  on public.app_notificacoes for all
  to service_role
  using (true) with check (true);
