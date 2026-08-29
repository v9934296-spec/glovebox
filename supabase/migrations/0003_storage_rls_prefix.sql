-- Tighten glovebox-media RLS: require the object name to start with
-- "<auth uid>/" and reject ".." segments. Replaces foldername()[1], which
-- only inspected the first path component and allowed traversal.
-- Run after 0001_init.sql (and 0002) in the SQL editor, or `supabase db push`.

drop policy if exists "media owner read" on storage.objects;
create policy "media owner read" on storage.objects
  for select using (
    bucket_id = 'glovebox-media'
    and name like (auth.uid()::text || '/%')
    and name not like '%../%'
  );

drop policy if exists "media owner insert" on storage.objects;
create policy "media owner insert" on storage.objects
  for insert with check (
    bucket_id = 'glovebox-media'
    and name like (auth.uid()::text || '/%')
    and name not like '%../%'
  );

drop policy if exists "media owner update" on storage.objects;
create policy "media owner update" on storage.objects
  for update using (
    bucket_id = 'glovebox-media'
    and name like (auth.uid()::text || '/%')
    and name not like '%../%'
  );

drop policy if exists "media owner delete" on storage.objects;
create policy "media owner delete" on storage.objects
  for delete using (
    bucket_id = 'glovebox-media'
    and name like (auth.uid()::text || '/%')
    and name not like '%../%'
  );
