-- ============================================================
-- CBRio — Lembretes agendados (pg_cron -> Edge Function notify-lembretes)
-- Aplicado na produção (hhntwfawfnxvuobhdfkb) em 2026-06-12.
--
-- O job roda A CADA MINUTO e chama a function, que decide o que enviar:
--   · culto com transmissão online: push pra todos 5 min antes da hora
--   · batismo: véspera às 18h + no dia às 8h (batismo_inscricoes)
--   · NEXT: véspera do encontro às 18h (next_eventos/next_inscricoes)
-- Dedup por chave em app_lembretes_enviados (idempotente).
-- ============================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

create table if not exists public.app_lembretes_enviados (
  chave text primary key,
  enviado_em timestamptz not null default now()
);

alter table public.app_lembretes_enviados enable row level security;
-- Sem policies: só a service role (Edge Function) escreve/lê.

-- Limpeza: chaves com mais de 60 dias saem (rodada diária às 4h UTC)
select cron.schedule(
  'app-lembretes-limpeza',
  '0 4 * * *',
  $$delete from public.app_lembretes_enviados where enviado_em < now() - interval '60 days'$$
);

-- Job principal: a cada minuto
select cron.schedule(
  'app-lembretes',
  '* * * * *',
  $$
  select net.http_post(
    url := 'https://hhntwfawfnxvuobhdfkb.supabase.co/functions/v1/notify-lembretes',
    body := '{}'::jsonb,
    headers := '{"Content-Type": "application/json"}'::jsonb
  )
  $$
);
