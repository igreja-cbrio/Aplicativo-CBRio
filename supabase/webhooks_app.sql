-- ============================================================
-- CBRio — Webhooks (triggers SQL) que chamam as Edge Functions
-- via pg_net (extensão padrão do Supabase). Equivale aos "Database
-- Webhooks" do dashboard, mas em SQL versionado.
-- ============================================================

create extension if not exists pg_net;

-- Função helper: dispara http POST com o payload no formato de webhook do
-- Supabase ({ type, table, record, old_record }) pra Edge Function indicada.
create or replace function public.app_dispara_webhook(p_url text, p_record jsonb)
returns void
language plpgsql
security definer
set search_path = public, net
as $$
declare
  v_payload jsonb;
begin
  v_payload := jsonb_build_object('record', p_record);
  perform net.http_post(
    url := p_url,
    body := v_payload,
    headers := jsonb_build_object('Content-Type', 'application/json')
  );
end;
$$;

-- 1. INSERT em app_inscricoes -> confirmação (notify-inscricao-recebida)
create or replace function public.tr_app_inscricoes_recebida()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.app_dispara_webhook(
    'https://hhntwfawfnxvuobhdfkb.supabase.co/functions/v1/notify-inscricao-recebida',
    to_jsonb(NEW)
  );
  return NEW;
end; $$;

drop trigger if exists app_inscricoes_notify_recebida on public.app_inscricoes;
create trigger app_inscricoes_notify_recebida
  after insert on public.app_inscricoes
  for each row execute function public.tr_app_inscricoes_recebida();

-- 2. INSERT em app_inscricoes -> SOS
-- REMOVIDO em 2026-06-09 (PR SISTEMA_INTEGRADO_CBRIO #923):
-- A notificação de Cuidados (aconselhamento/oração/SOS) virou
-- responsabilidade exclusiva do backend principal (cbrio.org/api).
-- Manter este trigger causaria push duplicado pros pastores.
-- A Edge Function notify-cuidado-sos continua deployada como fallback,
-- mas não é mais chamada via trigger.
drop trigger if exists app_inscricoes_notify_sos on public.app_inscricoes;
drop function if exists public.tr_app_inscricoes_sos();

-- 3. INSERT em mem_grupo_pedidos -> notify-grupo-pedido
create or replace function public.tr_mem_grupo_pedidos_notify()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.app_dispara_webhook(
    'https://hhntwfawfnxvuobhdfkb.supabase.co/functions/v1/notify-grupo-pedido',
    to_jsonb(NEW)
  );
  return NEW;
end; $$;

drop trigger if exists mem_grupo_pedidos_notify on public.mem_grupo_pedidos;
create trigger mem_grupo_pedidos_notify
  after insert on public.mem_grupo_pedidos
  for each row execute function public.tr_mem_grupo_pedidos_notify();

-- 4. INSERT em mem_escalas -> notify-escala
create or replace function public.tr_mem_escalas_notify()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.app_dispara_webhook(
    'https://hhntwfawfnxvuobhdfkb.supabase.co/functions/v1/notify-escala',
    to_jsonb(NEW)
  );
  return NEW;
end; $$;

drop trigger if exists mem_escalas_notify on public.mem_escalas;
create trigger mem_escalas_notify
  after insert on public.mem_escalas
  for each row execute function public.tr_mem_escalas_notify();
