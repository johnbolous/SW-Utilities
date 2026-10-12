-- ============================================================================
-- Silicon Waha Utilities Portal — 002_rls.sql
--
-- With custom auth, Postgres has no auth.uid() to key policies on. The
-- correct model here (see chat for the fuller explanation): every table gets
-- RLS enabled with NO policies for the anon/authenticated Postgres roles —
-- meaning a leaked NEXT_PUBLIC_SUPABASE_ANON_KEY gets nothing at all. All
-- real reads/writes happen through Next.js API routes using the
-- SUPABASE_SERVICE_ROLE_KEY, which Postgres grants BYPASSRLS by default —
-- so service-role queries are unaffected by these policies. Authorization
-- (who may do what) is enforced in the API route code against our own
-- users/sessions tables, not here.
--
-- This file's job is narrow but important: make sure nothing is reachable
-- except through that trusted server path.
-- ============================================================================

alter table users enable row level security;
alter table sessions enable row level security;
alter table buildings enable row level security;
alter table floors enable row level security;
alter table meters enable row level security;
alter table solar_inverters enable row level security;
alter table water_meters enable row level security;
alter table kiosks enable row level security;
alter table electric_readings enable row level security;
alter table solar_production enable row level security;
alter table water_readings enable row level security;
alter table kiosk_readings enable row level security;
alter table photos enable row level security;
alter table alerts enable row level security;
alter table audit_log enable row level security;
alter table settings enable row level security;

-- Belt-and-suspenders: explicitly revoke table privileges from the two
-- Supabase-managed roles a browser client could ever authenticate as.
-- (RLS with zero policies already blocks all rows; this additionally blocks
-- the statements themselves.)
revoke all on all tables in schema public from anon, authenticated;
alter default privileges in schema public revoke all on tables from anon, authenticated;

-- storage.objects: same posture for the meter-photos bucket — see
-- 005_storage.sql, which creates the bucket and its own deny-all policies.
