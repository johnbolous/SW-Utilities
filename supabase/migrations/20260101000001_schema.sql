-- ============================================================================
-- Silicon Waha Utilities Portal — 001_schema.sql
-- Custom username/password auth (no Supabase Auth). Run after enabling pgcrypto.
-- ============================================================================

create extension if not exists pgcrypto;

-- ============================== ENUMS ======================================
-- CREATE TYPE has no IF NOT EXISTS in PostgreSQL — guarded so this migration
-- can be safely re-run against a project where it partially applied before.

do $$ begin
  create type user_role as enum ('admin', 'engineer', 'technician');
exception when duplicate_object then null; end $$;

do $$ begin
  create type meter_category as enum ('LOW', 'MEDIUM');
exception when duplicate_object then null; end $$;

do $$ begin
  create type reading_frequency as enum ('DAILY', 'MONTHLY');
exception when duplicate_object then null; end $$;

do $$ begin
  create type water_meter_type as enum ('DRINKING', 'IRRIGATION', 'FACTORY');
exception when duplicate_object then null; end $$;

do $$ begin
  create type alert_type as enum ('LOW_READING', 'HIGH_CONSUMPTION', 'ZERO_SOLAR', 'MISSING_READING');
exception when duplicate_object then null; end $$;

do $$ begin
  create type alert_severity as enum ('warning', 'critical');
exception when duplicate_object then null; end $$;

do $$ begin
  create type reading_entity_type as enum ('LOW', 'MEDIUM', 'SOLAR', 'WATER', 'KIOSK');
exception when duplicate_object then null; end $$;

do $$ begin
  create type photo_status as enum ('pending', 'approved', 'rejected');
exception when duplicate_object then null; end $$;

-- ============================== USERS & SESSIONS ===========================
-- Custom auth: no auth.users table exists at all. Passwords are bcrypt
-- hashes (12 rounds, hashed in lib/auth/password.ts). Sessions are opaque
-- random tokens; only their SHA-256 hash is stored (fast, appropriate for a
-- high-entropy token — bcrypt is deliberately reserved for passwords only).

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  username text unique not null check (username ~ '^[a-zA-Z0-9_.-]{3,32}$'),
  password_hash text not null,
  full_name text not null,
  role user_role not null default 'technician',
  is_active boolean not null default true,
  must_change_password boolean not null default false,
  language text not null default 'en' check (language in ('en', 'ar')),
  theme text not null default 'dark' check (theme in ('dark', 'light')),
  created_at timestamptz not null default now(),
  created_by uuid references users(id)
);

create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  token_hash text unique not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  last_seen_at timestamptz not null default now(),
  user_agent text,
  ip text
);
create index if not exists idx_sessions_user on sessions(user_id);
create index if not exists idx_sessions_expires on sessions(expires_at);

-- ============================== STRUCTURE ==================================

create table if not exists buildings (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name_en text not null,
  name_ar text,
  excel_sheet_hint text,
  excel_label text,
  excel_color_hex text,
  has_meters boolean not null default true,
  sort_order int not null default 0,
  is_active boolean not null default true
);

create table if not exists floors (
  id uuid primary key default gen_random_uuid(),
  building_id uuid not null references buildings(id) on delete cascade,
  code text not null,
  name_en text not null,
  name_ar text,
  sort_order int not null default 0,
  unique (building_id, code)
);

-- ============================== ELECTRIC METERS (LOW + MEDIUM) ============

create table if not exists meters (
  id uuid primary key default gen_random_uuid(),
  category meter_category not null,
  building_id uuid not null references buildings(id),
  floor_id uuid references floors(id),
  room_code text,
  tenant_name text,
  label_en text not null,
  label_ar text,
  meter_code text unique not null,        -- e.g. 'LOW-TR-GA1' — used in photo filenames & watermark
  reading_frequency reading_frequency not null default 'DAILY',
  monthly_reading_day int check (monthly_reading_day between 1 and 28),
  excel_sheet text,
  excel_column text,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint monthly_needs_day check (
    (reading_frequency = 'DAILY' and monthly_reading_day is null) or
    (reading_frequency = 'MONTHLY' and monthly_reading_day is not null)
  )
);
create index if not exists idx_meters_building on meters(building_id);
create index if not exists idx_meters_category on meters(category);
create index if not exists idx_meters_frequency on meters(reading_frequency);

-- ============================== SOLAR ======================================

create table if not exists solar_inverters (
  id uuid primary key default gen_random_uuid(),
  building_id uuid not null references buildings(id),
  inverter_no int not null,
  label_en text not null,
  meter_code text unique not null,        -- e.g. 'SOLAR-TR-1'
  excel_sheet text default 'Solar cell',
  excel_column text,
  is_active boolean not null default true,
  unique (building_id, inverter_no)
);

-- ============================== WATER ======================================

create table if not exists water_meters (
  id uuid primary key default gen_random_uuid(),
  type water_meter_type not null,
  label_en text not null,
  label_ar text,
  meter_code text unique not null,        -- e.g. 'WATER-DRINK'
  reading_frequency reading_frequency not null default 'DAILY',
  monthly_reading_day int check (monthly_reading_day between 1 and 28),
  excel_sheet text default 'D W',
  excel_column text,
  is_active boolean not null default true,
  constraint water_monthly_needs_day check (
    (reading_frequency = 'DAILY' and monthly_reading_day is null) or
    (reading_frequency = 'MONTHLY' and monthly_reading_day is not null)
  )
);

-- ============================== KIOSKS =====================================

create table if not exists kiosks (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  meter_code text unique not null,        -- e.g. 'KIOSK-SKYT'
  excel_sheet text default 'koshks',
  excel_column text,
  is_active boolean not null default true,
  sort_order int not null default 0
);

-- ============================== READINGS: ELECTRIC =========================

create table if not exists electric_readings (
  id uuid primary key default gen_random_uuid(),
  meter_id uuid not null references meters(id) on delete restrict,
  reading_date date not null,
  reading_frequency reading_frequency not null,
  previous_value numeric(14,3) not null,
  current_value numeric(14,3) not null,
  consumption numeric(14,3) generated always as (current_value - previous_value) stored,
  is_lower_confirmed boolean not null default false,
  notes text,
  technician_id uuid not null references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  updated_by uuid references users(id),
  -- Plain generated column instead of an expression index on date_trunc():
  -- reviewer guidance is to never key an index off date_trunc()/now()/
  -- current_timestamp. date_trunc(text, date) technically resolves to the
  -- IMMUTABLE timestamp overload so the old expression index form would
  -- have worked, but this is unambiguous, doesn't rely on that overload
  -- resolution rule, and is easier to reason about at a glance.
  reading_month int generated always as (
    (extract(year from reading_date)::int * 100) + extract(month from reading_date)::int
  ) stored
);
create index if not exists idx_electric_readings_meter_date on electric_readings(meter_id, reading_date desc);
create unique index if not exists uq_electric_daily on electric_readings (meter_id, reading_date)
  where reading_frequency = 'DAILY';
create unique index if not exists uq_electric_monthly on electric_readings (meter_id, reading_month)
  where reading_frequency = 'MONTHLY';

-- ============================== READINGS: SOLAR =============================

create table if not exists solar_production (
  id uuid primary key default gen_random_uuid(),
  inverter_id uuid not null references solar_inverters(id) on delete restrict,
  production_date date not null,
  value numeric(14,3) not null,
  technician_id uuid not null references users(id),
  notes text,
  created_at timestamptz not null default now(),
  unique (inverter_id, production_date)
);
create index if not exists idx_solar_production_date on solar_production(production_date);

-- ============================== READINGS: WATER =============================

create table if not exists water_readings (
  id uuid primary key default gen_random_uuid(),
  water_meter_id uuid not null references water_meters(id) on delete restrict,
  reading_date date not null,
  reading_frequency reading_frequency not null,
  previous_value numeric(14,3) not null,
  current_value numeric(14,3) not null,
  consumption numeric(14,3) generated always as (current_value - previous_value) stored,
  is_lower_confirmed boolean not null default false,
  notes text,
  technician_id uuid not null references users(id),
  created_at timestamptz not null default now(),
  reading_month int generated always as (
    (extract(year from reading_date)::int * 100) + extract(month from reading_date)::int
  ) stored
);
create index if not exists idx_water_readings_meter_date on water_readings(water_meter_id, reading_date desc);
create unique index if not exists uq_water_daily on water_readings (water_meter_id, reading_date)
  where reading_frequency = 'DAILY';
create unique index if not exists uq_water_monthly on water_readings (water_meter_id, reading_month)
  where reading_frequency = 'MONTHLY';

-- ============================== READINGS: KIOSKS ============================

create table if not exists kiosk_readings (
  id uuid primary key default gen_random_uuid(),
  kiosk_id uuid not null references kiosks(id) on delete restrict,
  reading_date date not null,
  previous_value numeric(14,3) not null,
  current_value numeric(14,3) not null,
  consumption numeric(14,3) generated always as (current_value - previous_value) stored,
  is_lower_confirmed boolean not null default false,
  notes text,
  technician_id uuid not null references users(id),
  created_at timestamptz not null default now(),
  reading_month int generated always as (
    (extract(year from reading_date)::int * 100) + extract(month from reading_date)::int
  ) stored
);
create unique index if not exists uq_kiosk_monthly on kiosk_readings (kiosk_id, reading_month);

-- ============================== PHOTOS ======================================
-- One row per uploaded version. Never overwritten — "latest approved" is
-- resolved by a query (see the view below), not by mutation.

create table if not exists photos (
  id uuid primary key default gen_random_uuid(),
  reading_entity_type reading_entity_type not null,
  -- Exactly one of these is set, matching reading_entity_type:
  meter_id uuid references meters(id) on delete restrict,
  inverter_id uuid references solar_inverters(id) on delete restrict,
  water_meter_id uuid references water_meters(id) on delete restrict,
  kiosk_id uuid references kiosks(id) on delete restrict,

  reading_date date not null,
  storage_path text not null,             -- path inside the 'meter-photos' bucket
  file_name text not null,                -- 'YYYY-MM-DD_MeterCode.jpg', versioned with -v2, -v3...
  version int not null default 1,

  captured_by uuid not null references users(id),
  captured_at timestamptz not null default now(),

  quality_warning boolean not null default false,
  quality_notes text,

  status photo_status not null default 'pending',
  reviewed_by uuid references users(id),
  reviewed_at timestamptz,
  replaced_reason text,                   -- set when this version superseded an earlier one

  constraint photo_entity_matches_type check (
    (reading_entity_type in ('LOW','MEDIUM') and meter_id is not null and inverter_id is null and water_meter_id is null and kiosk_id is null) or
    (reading_entity_type = 'SOLAR' and inverter_id is not null and meter_id is null and water_meter_id is null and kiosk_id is null) or
    (reading_entity_type = 'WATER' and water_meter_id is not null and meter_id is null and inverter_id is null and kiosk_id is null) or
    (reading_entity_type = 'KIOSK' and kiosk_id is not null and meter_id is null and inverter_id is null and water_meter_id is null)
  )
);
create index if not exists idx_photos_meter on photos(meter_id, reading_date desc);
create index if not exists idx_photos_inverter on photos(inverter_id, reading_date desc);
create index if not exists idx_photos_water_meter on photos(water_meter_id, reading_date desc);
create index if not exists idx_photos_kiosk on photos(kiosk_id, reading_date desc);
create index if not exists idx_photos_status on photos(status);

-- "Latest visible photo per entity per date" — what engineers see by default
-- (pending shown too, until an admin explicitly rejects it).
create or replace view latest_visible_photos with (security_invoker = true) as
select distinct on (
  reading_entity_type,
  coalesce(meter_id, '00000000-0000-0000-0000-000000000000'),
  coalesce(inverter_id, '00000000-0000-0000-0000-000000000000'),
  coalesce(water_meter_id, '00000000-0000-0000-0000-000000000000'),
  coalesce(kiosk_id, '00000000-0000-0000-0000-000000000000'),
  reading_date
)
  *
from photos
where status in ('approved', 'pending')
order by
  reading_entity_type,
  coalesce(meter_id, '00000000-0000-0000-0000-000000000000'),
  coalesce(inverter_id, '00000000-0000-0000-0000-000000000000'),
  coalesce(water_meter_id, '00000000-0000-0000-0000-000000000000'),
  coalesce(kiosk_id, '00000000-0000-0000-0000-000000000000'),
  reading_date,
  version desc;

-- ============================== ALERTS ======================================

create table if not exists alerts (
  id uuid primary key default gen_random_uuid(),
  type alert_type not null,
  severity alert_severity not null default 'warning',
  meter_id uuid references meters(id) on delete cascade,
  inverter_id uuid references solar_inverters(id) on delete cascade,
  water_meter_id uuid references water_meters(id) on delete cascade,
  reading_ref_id uuid,
  message text not null,
  is_resolved boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_alerts_created on alerts(created_at desc);
create index if not exists idx_alerts_unresolved on alerts(is_resolved) where is_resolved = false;

-- ============================== AUDIT LOG ===================================

create table if not exists audit_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id),
  action text not null,
  table_name text not null,
  record_id uuid,
  old_value jsonb,
  new_value jsonb,
  reason text,
  created_at timestamptz not null default now()
);
create index if not exists idx_audit_log_created on audit_log(created_at desc);
create index if not exists idx_audit_log_user on audit_log(user_id);
create index if not exists idx_audit_log_table_record on audit_log(table_name, record_id);

-- ============================== SETTINGS ====================================

create table if not exists settings (
  key text primary key,
  value jsonb not null,
  updated_by uuid references users(id),
  updated_at timestamptz not null default now()
);
