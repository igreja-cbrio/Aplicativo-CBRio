-- =====================================================================
-- Escalas (vol_schedules) integradas ao app:
--  1. Backfill: linka vol_profiles.membresia_id a partir do CPF (quando
--     não há vínculo ainda) — garante o "cruze nome+cpf" pedido.
--  2. Trigger: ao inserir em vol_schedules, dispara Edge Function
--     notify-escala (in-app + push).
--  3. Idempotente.
-- =====================================================================

-- 1) Backfill: vol_profiles sem membresia_id, mas com CPF que bate em
--    mem_membros.cpf, recebem o vínculo.
update public.vol_profiles vp
   set membresia_id = m.id, updated_at = now()
  from public.mem_membros m
 where vp.membresia_id is null
   and vp.cpf is not null
   and regexp_replace(vp.cpf, '\D', '', 'g') <> ''
   and regexp_replace(vp.cpf, '\D', '', 'g') = regexp_replace(coalesce(m.cpf,''), '\D', '', 'g');

-- 2) Trigger pra notificar o voluntário ao ser escalado.
create or replace function public.tr_vol_schedules_notify()
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

drop trigger if exists vol_schedules_notify on public.vol_schedules;
create trigger vol_schedules_notify
  after insert on public.vol_schedules
  for each row execute function public.tr_vol_schedules_notify();
