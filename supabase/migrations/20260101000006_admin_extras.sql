-- ============================================================================
-- Silicon Waha Utilities Portal — 006_admin_extras.sql
-- Small additions needed for the Admin module: last-login tracking.
-- ============================================================================

alter table users add column if not exists last_login_at timestamptz;

create index if not exists idx_users_role on users(role);
create index if not exists idx_users_is_active on users(is_active);
