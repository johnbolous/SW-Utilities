import { NextResponse, type NextRequest } from "next/server";
import { requireRole } from "@/lib/auth/requireRole";
import { createAdminClient } from "@/lib/supabase/admin";
import { parsePagination } from "@/lib/admin/pagination";
import { logAudit } from "@/lib/admin/audit";
import type { Database } from "@/types/database";

export async function GET(request: NextRequest) {
  const guard = await requireRole(["admin"]);
  if (guard instanceof NextResponse) return guard;

  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  const buildingId = request.nextUrl.searchParams.get("buildingId") ?? "";
  const floorId = request.nextUrl.searchParams.get("floorId") ?? "";
  const parkId = request.nextUrl.searchParams.get("parkId") ?? "";

  const { page, pageSize, from, to } = parsePagination(request, 50);

  const supabase = createAdminClient();

  let query = supabase
    .from("rooms")
    .select("*", { count: "exact" })
    .order("sort_order");

  if (q) query = query.or(`name_en.ilike.%${q}%,name_ar.ilike.%${q}%`);
  if (parkId) {
  const { data: parkBuildings } = await supabase
    .from("buildings")
    .select("id")
    .eq("technology_park_id", parkId);

  const ids = (parkBuildings ?? []).map((b) => b.id);

  if (ids.length === 0) {
    return NextResponse.json({
      rooms: [],
      total: 0,
      page,
      pageSize,
    });
  }

  query = query.in("building_id", ids);
}
  if (buildingId) query = query.eq("building_id", buildingId);
  if (floorId) query = query.eq("floor_id", floorId);

  const { data, error, count } = await query.range(from, to);

  if (error)
    return NextResponse.json(
      { error: "LOAD_FAILED", detail: error.message },
      { status: 500 }
    );

  const rooms = data ?? [];

  const buildingIds = [...new Set(rooms.map((r) => r.building_id))];
  const floorIds = [...new Set(rooms.map((r) => r.floor_id))];

  const [{ data: buildings }, { data: floors }] = await Promise.all([
    buildingIds.length
      ? supabase.from("buildings").select("id,name_en").in("id", buildingIds)
      : Promise.resolve({ data: [] }),

    floorIds.length
      ? supabase.from("floors").select("id,name_en").in("id", floorIds)
      : Promise.resolve({ data: [] }),
  ]);

  const buildingMap = new Map(
    (buildings ?? []).map((b) => [b.id, b.name_en])
  );

  const floorMap = new Map(
    (floors ?? []).map((f) => [f.id, f.name_en])
  );

  return NextResponse.json({
    rooms: rooms.map((r) => ({
      ...r,
      buildings: {
        name_en: buildingMap.get(r.building_id) ?? "—",
      },
      floors: {
        name_en: floorMap.get(r.floor_id) ?? "—",
      },
    })),
    total: count ?? 0,
    page,
    pageSize,
  });
}

export async function POST(request: NextRequest) {
  const guard = await requireRole(["admin"]);
  if (guard instanceof NextResponse) return guard;

  const admin = guard;

  const body = await request.json().catch(() => null);

  if (!body)
    return NextResponse.json(
      { error: "INVALID_BODY" },
      { status: 400 }
    );

  const buildingId = body.buildingId;
  const floorId = body.floorId;

  const nameEn = body.nameEn?.trim();
  const nameAr = body.nameAr?.trim() || null;

  const sortOrder = Number(body.sortOrder) || 0;

  if (!buildingId)
    return NextResponse.json(
      { error: "MISSING_BUILDING" },
      { status: 400 }
    );

  if (!floorId)
    return NextResponse.json(
      { error: "MISSING_FLOOR" },
      { status: 400 }
    );

  if (!nameEn)
    return NextResponse.json(
      { error: "MISSING_NAME" },
      { status: 400 }
    );

  const supabase = createAdminClient();
  const { data: existing } = await supabase
  .from("rooms")
  .select("id")
  .eq("floor_id", floorId)
  .eq("name_en", nameEn)
  .maybeSingle();

if (existing) {
  return NextResponse.json(
    { error: "ROOM_EXISTS" },
    { status: 409 }
  );
}

  const insertRow: Database["public"]["Tables"]["rooms"]["Insert"] = {
    building_id: buildingId,
    floor_id: floorId,
    name_en: nameEn,
    name_ar: nameAr,
    sort_order: sortOrder,
    is_active: true,
  };

  const { data, error } = await supabase
    .from("rooms")
    .insert(insertRow)
    .select()
    .single();

  if (error)
    return NextResponse.json(
      { error: "INSERT_FAILED", detail: error.message },
      { status: 500 }
    );

  await logAudit(supabase, {
    actorId: admin.id,
    action: "room_created",
    tableName: "rooms",
    recordId: data.id,
    newValue: data,
  });

 const [{ data: building }, { data: floor }] = await Promise.all([
  supabase
    .from("buildings")
    .select("name_en")
    .eq("id", buildingId)
    .single(),

  supabase
    .from("floors")
    .select("name_en")
    .eq("id", floorId)
    .single(),
]);

return NextResponse.json(
  {
    room: {
      ...data,
      buildings: {
        name_en: building?.name_en ?? "—",
      },
      floors: {
        name_en: floor?.name_en ?? "—",
      },
    },
  },
  { status: 201 }
);
 
}