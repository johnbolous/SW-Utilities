-- ============================================================================
-- Silicon Waha Utilities Portal — seed.sql
-- Buildings/floors/meters/inverters/water meters/kiosks from the uploaded
-- template + confirmed spec clarifications. Every meter now also has a short
-- `meter_code` (e.g. 'LOW-TR-G') used in photo filenames and watermarks.
--
-- No users are seeded here — create your first admin with
-- `npm run create-user` (see README), since there's no Supabase Auth
-- dashboard to do it from anymore.
--
-- ASSUMPTION FLAGGED FOR REVIEW: the "Low" sheet's "مبني التعهيد" (Call
-- Center) column may be a separate building-level incoming meter distinct
-- from the 12 room sub-meters on the "Call Center" sheet. This seed follows
-- the written spec's explicit room breakdown only (12 meters).
-- ============================================================================

-- ============================== BUILDINGS ===================================

insert into buildings (code, name_en, name_ar, excel_sheet_hint, excel_label, excel_color_hex, has_meters, sort_order) values
  ('training',     'Training Building',  'مبني التدريب',   'Low', 'مبني التدريب',   'C00000', true,  1),
  ('companies',    'Companies Building', 'مبني الشركات',   'Low', 'مبني الشركات',   '0070C0', true,  2),
  ('innovation',   'Innovation Building','مبني الابداع',   'Low', 'مبني الابداع',   'FFC000', true,  3),
  ('ntra',         'NTRA Building',      'مبني نترا',      'Low', 'مبني نترا',      '00B0F0', true,  4),
  ('call_center',  'Call Center Building','مبني التعهيد',  'Call Center', 'عدادات قاعات مبني التعهيد', 'FFFF00', true, 5),
  ('post',         'Post Building',      'مبني البريد',    'Low', 'مبني البريد',    '00B050', true,  6),
  ('services',     'Services Building',  'مبني الخدمات',   'Low', 'مبني الخدمات',   '7030A0', true,  7),
  ('school',       'School Building',    'مبني المدرسه',   'Low', 'مبني المدرسه',   'FF0000', true,  8),
  ('hyper',        'Hyper Building',     'مبني الهايبر',   null,  null, null, false, 9),
  ('plaza_1',       'Plaza 1',            'محلات 1',        'shops', 'محلات 1', '00B050', true, 10),
  ('plaza_2',       'Plaza 2',            'محلات 2',        'shops', 'محلات 2', '00B050', true, 11),
  ('plaza_3',       'Plaza 3',            'محلات 3',        'shops', 'محلات 3', '00B050', true, 12),
  ('e_and',         'E& Building',        'مبني اتصالات',   'Solar cell', 'اتصالات', 'C55911', true, 13),
  ('sico_factory',  'Sico Factory',       'مصنع سيكو',      'Medium', null, null, true, 14)
on conflict (code) do nothing;

-- ============================== FLOORS ======================================

insert into floors (building_id, code, name_en, name_ar, sort_order)
select id, 'ground', 'Ground', 'الدور الارضي', 1 from buildings where code = 'training'
on conflict (building_id, code) do nothing;
insert into floors (building_id, code, name_en, name_ar, sort_order)
select id, 'first', 'First', 'الدور الاول', 2 from buildings where code = 'training'
on conflict (building_id, code) do nothing;

insert into floors (building_id, code, name_en, name_ar, sort_order)
select id, 'ground', 'Ground', 'الدور الارضي', 1 from buildings where code = 'companies'
on conflict (building_id, code) do nothing;
insert into floors (building_id, code, name_en, name_ar, sort_order)
select id, 'first', 'First', 'الدور الاول', 2 from buildings where code = 'companies'
on conflict (building_id, code) do nothing;
insert into floors (building_id, code, name_en, name_ar, sort_order)
select id, 'second', 'Second', 'الدور الثاني', 3 from buildings where code = 'companies'
on conflict (building_id, code) do nothing;

insert into floors (building_id, code, name_en, name_ar, sort_order)
select id, 'ground', 'Ground', 'الدور الارضي', 1 from buildings b where b.code in
  ('innovation','ntra','post','services','school','plaza_1','plaza_2','plaza_3','e_and')
on conflict (building_id, code) do nothing;

insert into floors (building_id, code, name_en, name_ar, sort_order)
select id, 'ground', 'Ground Floor', 'الدور الارضي', 1 from buildings where code = 'call_center'
on conflict (building_id, code) do nothing;
insert into floors (building_id, code, name_en, name_ar, sort_order)
select id, 'first', 'First Floor', 'الدور الاول علوي', 2 from buildings where code = 'call_center'
on conflict (building_id, code) do nothing;
insert into floors (building_id, code, name_en, name_ar, sort_order)
select id, 'second', 'Second Floor', 'الدور الثاني علوي', 3 from buildings where code = 'call_center'
on conflict (building_id, code) do nothing;

-- ============================== LOW METERS ==================================

with singles(code, meter_code) as (
  values ('innovation','LOW-IN-G'), ('ntra','LOW-NT-G'), ('post','LOW-PO-G'),
         ('services','LOW-SV-G'), ('school','LOW-SC-G'), ('e_and','LOW-EA-G')
)
insert into meters (category, building_id, floor_id, label_en, meter_code, excel_sheet, sort_order)
select 'LOW', b.id, f.id, b.name_en || ' — Ground Floor LOW Meter', s.meter_code, 'Low', 1
from buildings b
join floors f on f.building_id = b.id and f.code = 'ground'
join singles s on s.code = b.code
on conflict (meter_code) do nothing;

with singles(code, meter_code) as (
  values ('plaza_1','LOW-P1-G'), ('plaza_2','LOW-P2-G'), ('plaza_3','LOW-P3-G')
)
insert into meters (category, building_id, floor_id, label_en, meter_code, excel_sheet, sort_order)
select 'LOW', b.id, f.id, b.name_en, s.meter_code, 'shops', 1
from buildings b
join floors f on f.building_id = b.id and f.code = 'ground'
join singles s on s.code = b.code
on conflict (meter_code) do nothing;

with tr(code, meter_code, ord) as (values ('ground','LOW-TR-G',1), ('first','LOW-TR-F',2))
insert into meters (category, building_id, floor_id, label_en, meter_code, excel_sheet, sort_order)
select 'LOW', b.id, f.id, 'Training Building — ' || f.name_en || ' Floor LOW Meter', t.meter_code, 'Low', t.ord
from buildings b join floors f on f.building_id = b.id join tr t on t.code = f.code
where b.code = 'training'
on conflict (meter_code) do nothing;

with co(code, meter_code, ord) as (values ('ground','LOW-CO-G',1), ('first','LOW-CO-F',2), ('second','LOW-CO-S',3))
insert into meters (category, building_id, floor_id, label_en, meter_code, excel_sheet, sort_order)
select 'LOW', b.id, f.id, 'Companies Building — ' || f.name_en || ' Floor LOW Meter', c.meter_code, 'Low', c.ord
from buildings b join floors f on f.building_id = b.id join co c on c.code = f.code
where b.code = 'companies'
on conflict (meter_code) do nothing;

insert into meters (category, building_id, floor_id, room_code, label_en, meter_code, excel_sheet, sort_order)
select 'LOW', b.id, f.id, room.code, 'Call Center Building — ' || f.name_en || ' — ' || room.code,
       'LOW-CC-' || room.code, 'Call Center', f.sort_order * 10 + room.ord
from buildings b
join floors f on f.building_id = b.id
join (values ('GA1',1),('GA2',2),('GA3',3),('GA4',4)) as room(code, ord) on f.code = 'ground'
where b.code = 'call_center'
union all
select 'LOW', b.id, f.id, room.code, 'Call Center Building — ' || f.name_en || ' — ' || room.code,
       'LOW-CC-' || room.code, 'Call Center', f.sort_order * 10 + room.ord
from buildings b
join floors f on f.building_id = b.id
join (values ('FA1',1),('FA2',2),('FA3',3),('FA4',4)) as room(code, ord) on f.code = 'first'
where b.code = 'call_center'
union all
select 'LOW', b.id, f.id, room.code, 'Call Center Building — ' || f.name_en || ' — ' || room.code,
       'LOW-CC-' || room.code, 'Call Center', f.sort_order * 10 + room.ord
from buildings b
join floors f on f.building_id = b.id
join (values ('SA1',1),('SA2',2),('SA3',3),('SA4',4)) as room(code, ord) on f.code = 'second'
where b.code = 'call_center'
on conflict (meter_code) do nothing;

-- ============================== MEDIUM METERS ===============================
-- "Post Meter" is preserved from the Excel template though not named in the
-- written spec — Excel is the primary reference for existing meters.

insert into meters (category, building_id, label_en, meter_code, excel_sheet, sort_order)
select 'MEDIUM', id, 'Training Meter', 'MED-TR', 'Medium', 1 from buildings where code = 'training'
on conflict (meter_code) do nothing;
insert into meters (category, building_id, label_en, meter_code, excel_sheet, sort_order)
select 'MEDIUM', id, 'Call Center Meter', 'MED-CC', 'Medium', 2 from buildings where code = 'call_center'
on conflict (meter_code) do nothing;
insert into meters (category, building_id, label_en, meter_code, excel_sheet, sort_order)
select 'MEDIUM', id, 'Post Meter', 'MED-PO', 'Medium', 3 from buildings where code = 'post'
on conflict (meter_code) do nothing;
insert into meters (category, building_id, label_en, meter_code, excel_sheet, sort_order)
select 'MEDIUM', id, 'Services Meter', 'MED-SV', 'Medium', 4 from buildings where code = 'services'
on conflict (meter_code) do nothing;
insert into meters (category, building_id, label_en, meter_code, excel_sheet, sort_order)
select 'MEDIUM', id, 'Innovation Meter', 'MED-IN', 'Medium', 5 from buildings where code = 'innovation'
on conflict (meter_code) do nothing;
insert into meters (category, building_id, label_en, meter_code, excel_sheet, sort_order)
select 'MEDIUM', id, 'Citizen Services Meter', 'MED-CS', 'Medium', 6 from buildings where code = 'e_and'
on conflict (meter_code) do nothing;
insert into meters (category, building_id, label_en, meter_code, reading_frequency, monthly_reading_day, excel_sheet, sort_order)
select 'MEDIUM', id, 'Sico Factory Meter', 'MED-SF', 'MONTHLY', 1, 'Medium', 7 from buildings where code = 'sico_factory'
on conflict (meter_code) do nothing;

-- ============================== SOLAR INVERTERS =============================
-- "اتصالات" (Telecom) column in the template's Solar cell sheet = E& Building.

with cnt(code, n, prefix) as (values
  ('training', 6, 'TR'), ('companies', 1, 'CO'), ('innovation', 2, 'IN'), ('ntra', 1, 'NT'),
  ('call_center', 3, 'CC'), ('e_and', 2, 'EA'), ('school', 1, 'SC'),
  ('plaza_1', 2, 'P1'), ('plaza_2', 2, 'P2'), ('plaza_3', 2, 'P3')
)
insert into solar_inverters (building_id, inverter_no, label_en, meter_code)
select b.id, gs.n, b.name_en || ' — Inverter ' || gs.n, 'SOLAR-' || cnt.prefix || '-' || gs.n
from buildings b
join cnt on cnt.code = b.code
join lateral generate_series(1, cnt.n) as gs(n) on true
on conflict (meter_code) do nothing;

-- ============================== WATER METERS =================================

insert into water_meters (type, label_en, label_ar, meter_code, reading_frequency) values
  ('DRINKING',  'Drinking Water Meter',  'عداد مياه الشرب', 'WATER-DRINK', 'DAILY'),
  ('IRRIGATION','Irrigation Water Meter','عداد مياه الري',  'WATER-IRR',   'DAILY')
on conflict (meter_code) do nothing;
insert into water_meters (type, label_en, label_ar, meter_code, reading_frequency, monthly_reading_day) values
  ('FACTORY', 'Factory Water Meter', 'عداد مياه المصنع', 'WATER-FACT', 'MONTHLY', 1)
on conflict (meter_code) do nothing;

-- ============================== KIOSKS ========================================

insert into kiosks (name, meter_code, sort_order) values
  ('SKY TAHEED', 'KIOSK-SKYT', 1),
  ('SKY CORPORATE 1', 'KIOSK-SKYC1', 2),
  ('SKY CORPORATE 2', 'KIOSK-SKYC2', 3),
  ('HALA CORPORATE', 'KIOSK-HALA', 4)
on conflict (meter_code) do nothing;

-- ============================== DEFAULT SETTINGS =============================

insert into settings (key, value) values
  ('company_name', '"Silicon Waha"'),
  ('site_name', '"Technology Park — Assiut"'),
  ('consumption_alert_threshold_pct', '20'),
  ('brand_color_primary', '"#003C70"'),
  ('brand_color_secondary', '"#706F6F"'),
  ('photo_max_upload_mb', '5')
on conflict (key) do nothing;

-- ============================== TECHNOLOGY PARKS ============================

insert into technology_parks (code, name, sort_order) values
  ('assiut', 'Assiut', 1),
  ('borg_el_arab', 'Borg El Arab', 2),
  ('sadat', 'Sadat', 3),
  ('beni_suef', 'Beni Suef', 4)
on conflict (code) do nothing;

-- All buildings seeded above pre-date Technology Parks and belong to the
-- facility the original uploaded report came from (Assiut) — backfill them
-- so existing data isn't orphaned from the new park-scoping rules.
update buildings
set technology_park_id = (select id from technology_parks where code = 'assiut')
where technology_park_id is null;

-- ============================== EDIT WINDOW SETTINGS =========================
-- Not hardcoded anywhere in application code — read at request time from
-- this table (see lib/admin/editWindow.ts). Admin can change these values
-- directly here or, once built, from a future Settings screen.

insert into settings (key, value) values
  ('technician_edit_window_days', '0'),
  ('engineer_edit_window_days', '3')
on conflict (key) do nothing;
