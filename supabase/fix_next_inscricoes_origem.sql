-- =====================================================================
-- Fix: CHECK de next_inscricoes.origem só aceitava 'formulario'/'manual',
-- bloqueando inscrições vindas do app (origem='app').
-- Mesmo padrão de bug da PR igreja-cbrio/SISTEMA_INTEGRADO_CBRIO#923 em
-- app_inscricoes.
-- 2026-06-09
-- =====================================================================

ALTER TABLE public.next_inscricoes
  DROP CONSTRAINT IF EXISTS next_inscricoes_origem_check;

ALTER TABLE public.next_inscricoes
  ADD CONSTRAINT next_inscricoes_origem_check
  CHECK (origem IN ('formulario','manual','app'));
