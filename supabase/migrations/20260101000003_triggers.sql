-- ============================================================================
-- Silicon Waha Utilities Portal — 003_triggers.sql
--
-- With no auth.uid(), audit triggers read the acting user from a
-- transaction-local setting (`app.current_user_id`) that every mutating API
-- route sets immediately before its query — see
-- lib/supabase/admin.ts::updateReadingWithReason(). This keeps "every edit
-- is logged, with who did it" true regardless of which route performs it.
--
-- Every function below pins `search_path` explicitly. None of these are
-- SECURITY DEFINER (they don't need elevated rights — the service role
-- already bypasses RLS), but pinning search_path is still correct practice:
-- it stops an unqualified table/function reference from ever resolving
-- against a schema earlier in some other search_path than the one intended.
-- ============================================================================

create or replace function audit_reading_update() returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid;
begin
  v_user_id := nullif(current_setting('app.current_user_id', true), '')::uuid;
  insert into audit_log (user_id, action, table_name, record_id, old_value, new_value, reason)
  values (
    v_user_id,
    'reading_edited',
    TG_TABLE_NAME,
    old.id,
    to_jsonb(old),
    to_jsonb(new),
    nullif(current_setting('app.edit_reason', true), '')
  );
  new.updated_at := now();
  new.updated_by := v_user_id;
  return new;
end;
$$;

drop trigger if exists trg_audit_electric_readings on electric_readings;
create trigger trg_audit_electric_readings
  before update on electric_readings
  for each row execute function audit_reading_update();

drop trigger if exists trg_audit_water_readings on water_readings;
create trigger trg_audit_water_readings
  before update on water_readings
  for each row execute function audit_reading_update();

-- kiosk_readings and solar_production don't have updated_at/updated_by
-- columns (edits to those are rare enough that Phase 1 doesn't model a full
-- edit trail for them beyond the audit_log row itself) — lighter variant
-- that skips those two column writes.
create or replace function audit_reading_update_no_meta() returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid;
begin
  v_user_id := nullif(current_setting('app.current_user_id', true), '')::uuid;
  insert into audit_log (user_id, action, table_name, record_id, old_value, new_value, reason)
  values (
    v_user_id, 'reading_edited', TG_TABLE_NAME, old.id, to_jsonb(old), to_jsonb(new),
    nullif(current_setting('app.edit_reason', true), '')
  );
  return new;
end;
$$;

drop trigger if exists trg_audit_kiosk_readings on kiosk_readings;
create trigger trg_audit_kiosk_readings
  before update on kiosk_readings
  for each row execute function audit_reading_update_no_meta();

drop trigger if exists trg_audit_solar_production on solar_production;
create trigger trg_audit_solar_production
  before update on solar_production
  for each row execute function audit_reading_update_no_meta();

-- ============================== HIGH CONSUMPTION ALERT ======================
-- ">20% above the trailing 30-day average" — applies to electric AND water
-- readings (both have the same previous/current/consumption shape). Kiosk
-- readings are monthly cumulative too but only ever have one data point a
-- month, so a 30-day trailing average is meaningless for them — intentionally
-- excluded, not an oversight.

create or replace function check_high_consumption_electric() returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  avg_consumption numeric;
begin
  select avg(consumption) into avg_consumption
  from electric_readings
  where meter_id = new.meter_id
    and reading_date < new.reading_date
    and reading_date >= new.reading_date - interval '30 days';

  if avg_consumption is not null and avg_consumption > 0
     and new.consumption > avg_consumption * 1.2 then
    insert into alerts (type, severity, meter_id, reading_ref_id, message)
    values (
      'HIGH_CONSUMPTION', 'warning', new.meter_id, new.id,
      format('Consumption %.2f is %.0f%% above the 30-day average of %.2f',
             new.consumption, ((new.consumption / avg_consumption) - 1) * 100, avg_consumption)
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_high_consumption_electric on electric_readings;
create trigger trg_high_consumption_electric
  after insert on electric_readings
  for each row execute function check_high_consumption_electric();

create or replace function check_high_consumption_water() returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  avg_consumption numeric;
begin
  select avg(consumption) into avg_consumption
  from water_readings
  where water_meter_id = new.water_meter_id
    and reading_date < new.reading_date
    and reading_date >= new.reading_date - interval '30 days';

  if avg_consumption is not null and avg_consumption > 0
     and new.consumption > avg_consumption * 1.2 then
    insert into alerts (type, severity, water_meter_id, reading_ref_id, message)
    values (
      'HIGH_CONSUMPTION', 'warning', new.water_meter_id, new.id,
      format('Consumption %.2f is %.0f%% above the 30-day average of %.2f',
             new.consumption, ((new.consumption / avg_consumption) - 1) * 100, avg_consumption)
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_high_consumption_water on water_readings;
create trigger trg_high_consumption_water
  after insert on water_readings
  for each row execute function check_high_consumption_water();

-- ============================== LOWER-THAN-PREVIOUS ALERT ===================
-- Bug fix: this was documented as a requirement (spec §Alerts: "Reading
-- Lower Than Previous") but never actually wired up in the original Phase 1
-- pass — the API only handled the save-time confirmation modal, nothing
-- logged it as a dashboard-visible alert. Fixed here at the DB level so it
-- fires regardless of which code path performs the insert.

create or replace function check_lower_reading_electric() returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.is_lower_confirmed then
    insert into alerts (type, severity, meter_id, reading_ref_id, message)
    values ('LOW_READING', 'warning', new.meter_id, new.id,
            format('Reading %.2f confirmed lower than previous %.2f.', new.current_value, new.previous_value));
  end if;
  return new;
end;
$$;

drop trigger if exists trg_lower_reading_electric on electric_readings;
create trigger trg_lower_reading_electric
  after insert on electric_readings
  for each row execute function check_lower_reading_electric();

create or replace function check_lower_reading_water() returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.is_lower_confirmed then
    insert into alerts (type, severity, water_meter_id, reading_ref_id, message)
    values ('LOW_READING', 'warning', new.water_meter_id, new.id,
            format('Reading %.2f confirmed lower than previous %.2f.', new.current_value, new.previous_value));
  end if;
  return new;
end;
$$;

drop trigger if exists trg_lower_reading_water on water_readings;
create trigger trg_lower_reading_water
  after insert on water_readings
  for each row execute function check_lower_reading_water();

-- ============================== ZERO SOLAR ALERT ============================

create or replace function check_zero_solar() returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.value = 0 then
    insert into alerts (type, severity, inverter_id, reading_ref_id, message)
    values ('ZERO_SOLAR', 'warning', new.inverter_id, new.id, 'Solar production recorded as zero.');
  end if;
  return new;
end;
$$;

drop trigger if exists trg_zero_solar on solar_production;
create trigger trg_zero_solar
  after insert on solar_production
  for each row execute function check_zero_solar();

-- ============================== SESSION HOUSEKEEPING ========================
-- Callable cleanup, not a trigger. Wire to a Vercel Cron route or pg_cron
-- once live; not required for correctness (session reads already reject
-- expired tokens), just keeps the table tidy.

create or replace function purge_expired_sessions() returns void
language sql
set search_path = public, pg_temp
as $$
  delete from sessions where expires_at < now();
$$;
