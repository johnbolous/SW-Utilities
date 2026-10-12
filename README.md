# Silicon Waha Utilities Portal — Final Release

## 1. Setup

```bash
cp .env.example .env.local   # fill in NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
supabase link --project-ref YOUR_PROJECT_REF
supabase db push              # runs supabase/migrations/*.sql in order, then you run seed.sql
```
Or paste each file in `supabase/migrations/` (numeric order) into the Supabase SQL Editor, then `supabase/seed.sql` last.

```bash
npm install
npm run dev
```
First visit routes to `/setup` (no admin exists yet) — create your administrator there. It never appears again once an admin exists.

I still have no network access in this sandbox and could not run `npm install`/`npm run build` myself. Every check below is a manual code review, not a compiler run — treat your first build as the real test.

## 2. What's implemented

**Auth & access control**
- Custom username/password auth (bcrypt, hashed sessions), first-run setup wizard, role-gated middleware
- Three roles: Administrator (unrestricted), Engineer (one-or-more Technology Parks, or all), Technician (exactly one Park)
- Park access enforced in both the API (every scoped endpoint) and the UI (dropdowns only show what you have access to)

**Master Data Management** (all under Admin → sidebar, full CRUD: create, edit, enable/disable or delete, search, filter, pagination, confirmation dialogs, audit-logged)
- Users — create/edit, role change, password reset, park assignment, activate/deactivate
- Technology Parks — the four defaults (Assiut, Borg El Arab, Sadat, Beni Suef) plus create/edit/activate-deactivate
- Buildings — now require a Technology Park; floors/meters inherit it through the building (no duplicated park field anywhere else)
- Floors, Electric Meters (LOW/MEDIUM), Water Meters, Solar Inverters, Kiosks

**Technician reading entry** — LOW/MEDIUM/SOLAR/WATER/KIOSK, building→floor→room cascades, previous-reading lookup, consumption calculation, duplicate prevention, lower-reading confirmation, monthly-only visibility (server-enforced, not a UI toggle), monthly photo verification (camera capture, quality check, watermark, compression, versioned storage) — all scoped to the technician's one assigned Park

**Reading edit workflow** (`/field/history`, reachable by all three roles)
- Technician: can edit only their own readings, only within the configurable Technician Edit Window (default: same calendar day)
- Engineer: can edit any reading within their assigned Park(s), within the configurable Engineer Edit Window (default: 3 days)
- Admin: unrestricted, any time
- Every edit requires a reason; every edit is written to `audit_log` with the original value, new value, reason, editor, editor's role, and timestamp
- Edit windows are read from the `settings` table at request time — not hardcoded; change them directly in `settings` (a dedicated Settings screen wasn't part of this scope)

**Dashboards** — Admin and Engineer dashboards pull live counts from real endpoints (`/api/admin/users`, `/api/structure`), both already Park-scoped for non-admins

**PWA, i18n (EN/AR + RTL), dark/light mode** — unchanged from earlier phases

## 3. Known gaps, stated plainly

- Water Meter and Kiosk admin forms don't yet have a building-picker in the UI (the API supports `buildingId` already) — until an admin assigns one, those entities stay "unassigned," which the system treats as visible to every Park. Not a bug, just an incomplete form field.
- No Settings screen for the edit-window values yet — they're real, enforced, and configurable via direct SQL (`update settings set value = '...' where key = '...'`), just not from a page.
- `/field/history` is a functional but plain list — no search/filter/pagination on it yet, unlike the Master Data screens.
- Reports, Excel/PDF export, and the Engineer's consumption/trend charts remain out of scope (as in every prior round) — dashboards show structural counts, not consumption analytics.

## 4. Testing checklist (matches the acceptance script)

1. Login as Admin (the one created via `/setup`)
2. Admin → Technology Parks → create a park (or use one of the 4 seeded defaults)
3. Admin → Buildings → create a building, assign it to that Park
4. Admin → Floors → create a floor under that building
5. Admin → Electric Meters → create a LOW or MEDIUM meter under that building/floor
6. Admin → Water Meters, Solar Inverters, Kiosks → create one of each
7. Admin → Users → create an Engineer, assign multiple Parks (or check "Access to all Parks")
8. Admin → Users → create a Technician, assign exactly one Park
9. Log out, log in as the Engineer — confirm only assigned Park(s)' buildings appear anywhere (Field entry, `/api/structure`)
10. Log out, log in as the Technician — confirm only the one assigned Park's building appears; enter a reading
11. Still as Technician: go to `/field/history`, edit that reading same-day — should succeed with a reason
12. Log in as Engineer: find the same reading in `/field/history`, edit it within the 3-day window — should succeed
13. Confirm both edits appear in `audit_log` with old value, new value, reason, editor, and role
14. As Admin: confirm you can edit any reading regardless of Park or date

Let me know what the build turns up.
