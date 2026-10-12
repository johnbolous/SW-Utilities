-- ============================================================================
-- Silicon Waha Utilities Portal — 007_privilege_hardening.sql
--
-- Closes a gap the earlier migrations left open: PostgreSQL grants EXECUTE
-- on newly created functions to PUBLIC by default, and Supabase's PostgREST
-- layer auto-exposes public-schema functions as /rest/v1/rpc/<name>
-- endpoints reachable with just the anon key. 002_rls.sql locked down
-- TABLE access for anon/authenticated; this file does the same for
-- FUNCTION execute rights, and re-affirms the table lockdown now that every
-- table/view in the schema actually exists (002_rls.sql ran before some of
-- these were created).
--
-- Run this LAST — after every other migration.
-- ============================================================================

-- Tables + views (idempotent re-affirmation; harmless if 002_rls.sql's
-- revoke already covered everything).
revoke all on all tables in schema public from anon, authenticated;
alter default privileges in schema public revoke all on tables from anon, authenticated;

-- Functions.
revoke all on all functions in schema public from public, anon, authenticated;
alter default privileges in schema public revoke all on functions from public, anon, authenticated;

-- Sequences (none currently — every PK uses gen_random_uuid(), not a
-- serial/identity column — but this is here so it stays true if that ever
-- changes without anyone remembering to revisit this file).
revoke all on all sequences in schema public from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;

-- The service role bypasses RLS unconditionally (BYPASSRLS), but function
-- EXECUTE grants are a separate privilege system from RLS — grant it
-- explicitly rather than rely on an assumption about role inheritance.
grant usage on schema public to service_role;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;
alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant all on sequences to service_role;
alter default privileges in schema public grant execute on functions to service_role;
