-- HYDRASCAPES v5
-- 0009_storage_object_policies.sql
--
-- `0004_storage.sql` creates four PRIVATE buckets but defines no policies on
-- `storage.objects`. With storage RLS enabled (Supabase default) that means
-- every upload and every read is denied. This migration adds the minimum
-- policies the application needs.
--
-- Ownership convention, enforced by `buildStoragePath()` in
-- `app/lib/storage/upload-validation.ts`:
--
--     <auth.uid()>/<random>.<ext>
--
-- The first path segment is the uploader's user id. Everything else is
-- generated server-side, so a client cannot choose its own key.
--
-- These policies grant users access to their own folder only. Reads of other
-- people's images (listing photos for guests, inspection photos for the
-- counterparty) are served as short-lived signed URLs minted server-side with
-- the service role, which bypasses RLS by design.

begin;

-- ============================================================
-- OWNER-FOLDER ACCESS PER BUCKET
-- ============================================================

do $$
declare
  bucket text;
begin
  foreach bucket in array array[
    'property-photos',
    'inspection-photos',
    'message-media',
    'avatars'
  ]
  loop
    execute format($f$
      drop policy if exists %1$I on storage.objects;
    $f$, bucket || '_owner_select');

    execute format($f$
      create policy %1$I on storage.objects
      for select
      to authenticated
      using (
        bucket_id = %2$L
        and (storage.foldername(name))[1] = (select auth.uid())::text
      );
    $f$, bucket || '_owner_select', bucket);

    execute format($f$
      drop policy if exists %1$I on storage.objects;
    $f$, bucket || '_owner_insert');

    execute format($f$
      create policy %1$I on storage.objects
      for insert
      to authenticated
      with check (
        bucket_id = %2$L
        and (storage.foldername(name))[1] = (select auth.uid())::text
      );
    $f$, bucket || '_owner_insert', bucket);

    execute format($f$
      drop policy if exists %1$I on storage.objects;
    $f$, bucket || '_owner_update');

    execute format($f$
      create policy %1$I on storage.objects
      for update
      to authenticated
      using (
        bucket_id = %2$L
        and (storage.foldername(name))[1] = (select auth.uid())::text
      )
      with check (
        bucket_id = %2$L
        and (storage.foldername(name))[1] = (select auth.uid())::text
      );
    $f$, bucket || '_owner_update', bucket);

    execute format($f$
      drop policy if exists %1$I on storage.objects;
    $f$, bucket || '_owner_delete');

    execute format($f$
      create policy %1$I on storage.objects
      for delete
      to authenticated
      using (
        bucket_id = %2$L
        and (storage.foldername(name))[1] = (select auth.uid())::text
      );
    $f$, bucket || '_owner_delete', bucket);
  end loop;
end;
$$;

commit;
