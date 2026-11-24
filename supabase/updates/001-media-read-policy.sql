-- Update 001: Bilder dürfen nur gelöscht werden, wenn sie auch gelesen werden dürfen.
-- Ohne diese Regel bleiben gelöschte Bilder still im Speicher liegen.
-- Einmalig im Supabase SQL Editor ausführen (nur nötig, wenn schema.sql vor diesem Update eingespielt wurde).

create policy "media read own folder" on storage.objects
  for select to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = (select auth.uid())::text);
