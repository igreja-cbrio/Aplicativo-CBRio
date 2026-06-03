-- ============================================================
-- CBRio — Storage para foto de perfil (bucket "avatars")
-- 1) Crie o bucket no painel: Storage -> New bucket -> nome: avatars -> Public: ON
-- 2) Rode este script no SQL Editor para as políticas de acesso
-- Cada usuário gerencia apenas os arquivos da própria pasta (<uid>/...)
-- ============================================================

drop policy if exists "avatars_leitura_publica" on storage.objects;
create policy "avatars_leitura_publica"
  on storage.objects for select
  using (bucket_id = 'avatars');

drop policy if exists "avatars_insert_proprio" on storage.objects;
create policy "avatars_insert_proprio"
  on storage.objects for insert
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "avatars_update_proprio" on storage.objects;
create policy "avatars_update_proprio"
  on storage.objects for update
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "avatars_delete_proprio" on storage.objects;
create policy "avatars_delete_proprio"
  on storage.objects for delete
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
