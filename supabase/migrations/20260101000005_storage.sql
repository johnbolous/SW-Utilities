-- ============================================================================
-- Silicon Waha Utilities Portal — 005_storage.sql
-- Creates the meter-photos bucket. All uploads/downloads go through
-- app/api/photos/upload/route.ts and app/api/photos/[id]/route.ts using the
-- service role key — the browser never talks to Storage directly, so
-- storage.objects gets the same deny-all posture as the database tables.
-- ============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('meter-photos', 'meter-photos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- storage.objects already has RLS enabled by Supabase by default. No
-- policies are added for anon/authenticated here — deny-all, same as
-- 002_rls.sql. The service role bypasses RLS and is the only way in.

-- Because the bucket is private (public = false), reading a photo from the
-- browser requires a short-lived signed URL, generated server-side via
-- supabase.storage.from('meter-photos').createSignedUrl(path, expiresIn) —
-- see app/api/photos/[id]/route.ts.
