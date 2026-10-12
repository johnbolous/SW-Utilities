-- ============================================================================
-- Silicon Waha Utilities Portal — 004_functions.sql
-- ============================================================================

-- Called from lib/supabase/admin.ts::updateReadingWithReason(). Sets both the
-- acting user and the edit reason as transaction-local settings, then runs
-- the UPDATE — so 003_triggers.sql's audit trigger can read them atomically.
--
-- Defense in depth: this function re-checks the acting user's role itself
-- rather than trusting the caller to have checked it first. It's currently
-- only ever invoked from a service-role connection after the calling API
-- route has already verified admin/engineer, but a DB-level check means a
-- future route that forgets that check still can't use this to edit data —
-- and EXECUTE is revoked from anon/authenticated entirely in
-- 20260101000007_privilege_hardening.sql regardless.
create or replace function update_reading_with_reason(
  p_table text,
  p_id uuid,
  p_patch jsonb,
  p_reason text,
  p_user_id uuid
) returns jsonb
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_result jsonb;
  v_role user_role;
  v_allowed_tables text[] := array['electric_readings', 'water_readings', 'kiosk_readings', 'solar_production'];
begin
  select role into v_role from users where id = p_user_id and is_active;
  if v_role is null or v_role not in ('admin', 'engineer') then
    raise exception 'update_reading_with_reason: user % is not authorized to edit readings', p_user_id;
  end if;

  if p_reason is null or length(trim(p_reason)) = 0 then
    raise exception 'update_reading_with_reason: a reason is required';
  end if;

  if not (p_table = any(v_allowed_tables)) then
    raise exception 'update_reading_with_reason: table % is not editable via this function', p_table;
  end if;

  if p_table = 'solar_production' then
    if not (p_patch ?| array['value', 'notes']) then
      raise exception 'update_reading_with_reason: no editable fields in patch for %', p_table;
    end if;
  else
    if not (p_patch ?| array['current_value', 'previous_value', 'notes', 'is_lower_confirmed']) then
      raise exception 'update_reading_with_reason: no editable fields in patch for %', p_table;
    end if;
  end if;

  perform set_config('app.edit_reason', p_reason, true);
  perform set_config('app.current_user_id', p_user_id::text, true);

  execute format(
    'update %I set %s where id = $1 returning to_jsonb(%I.*)',
    p_table,
    (select string_agg(format('%I = ($2->>%L)::%s', key, key,
        case
          when key in ('current_value', 'previous_value', 'value') then 'numeric'
          when key = 'is_lower_confirmed' then 'boolean'
          else 'text'
        end
      ), ', ')
     from jsonb_object_keys(p_patch) as key),
    p_table
  )
  into v_result
  using p_id, p_patch;

  if v_result is null then
    raise exception 'update_reading_with_reason: no row % found in %', p_id, p_table;
  end if;

  return v_result;
end;
$$;

-- ============================== DATE AUTOMATION =============================
-- "Visible only on the 1st of the month" for Sico Factory Meter, Factory
-- Water Meter, and all Kiosk readings. Pure function of the server clock —
-- no manual selection anywhere in the UI. The application (lib/utils/date.ts)
-- duplicates this logic in TypeScript for the UI; these SQL versions exist
-- for any report/query that wants the same rule enforced at the DB level.

create or replace function is_monthly_reveal_day(p_date date default current_date) returns boolean
language sql
immutable
set search_path = public, pg_temp
as $$
  select extract(day from p_date) = 1;
$$;

create or replace function is_reading_open_today(
  p_frequency reading_frequency,
  p_monthly_day int,
  p_date date default current_date
) returns boolean
language sql
immutable
set search_path = public, pg_temp
as $$
  select case
    when p_frequency = 'DAILY' then true
    else extract(day from p_date) = coalesce(p_monthly_day, 1)
  end;
$$;
