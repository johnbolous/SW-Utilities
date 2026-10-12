-- ==========================================
-- Rooms
-- ==========================================

create table if not exists public.rooms (
    id uuid primary key default gen_random_uuid(),

    building_id uuid not null
        references public.buildings(id)
        on delete cascade,

    floor_id uuid not null
        references public.floors(id)
        on delete cascade,

    name_en text not null,
    name_ar text,

    sort_order int4 not null default 0,

    created_at timestamptz not null default now(),

    constraint rooms_unique_name_per_floor
        unique (floor_id, name_en)
);

create index if not exists idx_rooms_building
    on public.rooms(building_id);

create index if not exists idx_rooms_floor
    on public.rooms(floor_id);

create index if not exists idx_rooms_sort
    on public.rooms(sort_order);