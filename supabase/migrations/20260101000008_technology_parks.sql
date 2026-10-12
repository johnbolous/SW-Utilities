-- ============================================================================
-- Silicon Waha Utilities Portal — 008_technology_parks.sql
-- Multi-site support: every building belongs to exactly one Technology Park.
-- Floors/meters/water meters/inverters/kiosks inherit their park through
-- their building — no duplicated park column on those tables.
-- ============================================================================

create table if not exists technology_parks (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name text not null,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Nullable at the DB level on purpose: existing buildings pre-date this
-- feature. New buildings are required to set this by the API layer (see
-- app/api/admin/buildings/route.ts), not by a NOT NULL constraint — that
-- would make this migration fail the moment it runs against a DB that
-- already has building rows from an earlier phase, and seed.sql (which
-- backfills the existing buildings to a real park) runs AFTER all
-- migrations, so a NOT NULL constraint here would reject its own seed data
-- if ordered the other way.
alter table buildings add column if not exists technology_park_id uuid references technology_parks(id);
create index if not exists idx_buildings_park on buildings(technology_park_id);

-- Water meters and kiosks were originally modeled as facility-wide
-- singletons (no building). Technology Parks makes a real multi-site
-- deployment possible, where each park needs its own drinking/irrigation
-- water meters and kiosks — so both now optionally belong to a building
-- (and therefore a park) the same way solar inverters already did. Existing
-- rows keep building_id = null (treated as "shared/unassigned" — visible
-- regardless of park — see lib/admin/parkAccess.ts) until an admin assigns
-- them to a building via the Water Meters / Kiosks screens.
alter table water_meters add column if not exists building_id uuid references buildings(id);
alter table kiosks add column if not exists building_id uuid references buildings(id);
create index if not exists idx_water_meters_building on water_meters(building_id);
create index if not exists idx_kiosks_building on kiosks(building_id);

-- ============================== USER <-> PARK ACCESS =========================
-- Admin: no rows needed (always full access, checked by role alone).
-- Engineer: zero or more rows for specific parks, OR all_parks_access=true
--   (in which case any row in user_park_access for them is redundant/ignored).
-- Technician: exactly one row, all_parks_access always false — enforced by
--   the application layer (API validation), not a DB constraint, since
--   "exactly one for this role, any number for that role" isn't expressible
--   as a simple CHECK without also referencing the users table's role
--   inside the constraint (not supported directly in Postgres CHECKs).

alter table users add column if not exists all_parks_access boolean not null default false;

create table if not exists user_park_access (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  park_id uuid not null references technology_parks(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, park_id)
);
create index if not exists idx_user_park_access_user on user_park_access(user_id);
create index if not exists idx_user_park_access_park on user_park_access(park_id);

alter table technology_parks enable row level security;
alter table user_park_access enable row level security;
-- No policies added for anon/authenticated — same deny-by-default posture
-- as every other table (002_rls.sql). 007_privilege_hardening.sql's
-- `alter default privileges ... revoke all on tables from anon, authenticated`
-- already applies to tables created after it ran, which covers both of
-- these — the explicit revokes below are redundant belt-and-suspenders,
-- not strictly required.
revoke all on technology_parks from anon, authenticated;
revoke all on user_park_access from anon, authenticated;
