import { NextResponse, type NextRequest } from "next/server";
import { requireRole } from "@/lib/auth/requireRole";
import { createAdminClient } from "@/lib/supabase/admin";
import { parsePagination } from "@/lib/admin/pagination";
import { logAudit } from "@/lib/admin/audit";
import { isMeterCategory } from "@/lib/utils/enumGuards";
import type { Database } from "@/types/database";

export async function GET(request: NextRequest) {
  const guard = await requireRole(["admin"]);
  if (guard instanceof NextResponse) return guard;

  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  const categoryParam = request.nextUrl.searchParams.get("category") ?? "";
  const buildingId = request.nextUrl.searchParams.get("buildingId") ?? "";
  const parkId = request.nextUrl.searchParams.get("parkId") ?? "";
  const status = request.nextUrl.searchParams.get("status") ?? "";
  const { page, pageSize, from, to } = parsePagination(request, 50);

  const supabase = createAdminClient();

  // إذا تم اختيار منطقة (parkId)، نبحث عن المباني التابعة لها لضمان جلب عداداتها حتى لو لم يكن technology_park_id مسجلاً بشكل مباشر في جدول العدادات
  let buildingIdsInPark: string[] = [];
  if (parkId) {
    const { data: parkBuildings } = await supabase
      .from("buildings")
      .select("id")
      .eq("technology_park_id", parkId);
    
    buildingIdsInPark = (parkBuildings ?? []).map((b) => b.id);
  }

  let query = supabase
    .from("meters")
    .select("*", { count: "exact" })
    .order("sort_order");

  if (q) query = query.or(`label_en.ilike.%${q}%,meter_code.ilike.%${q}%`);
  if (isMeterCategory(categoryParam)) query = query.eq("category", categoryParam);
  
  if (buildingId) {
    query = query.eq("building_id", buildingId);
  } else if (parkId) {
    // فلترة ذكية: إما أن يكون العداد تابعاً للمنطقة مباشرة، أو تابعاً لمبنى داخل هذه المنطقة
    if (buildingIdsInPark.length > 0) {
      query = query.or(`technology_park_id.eq.${parkId},building_id.in.(${buildingIdsInPark.join(",")})`);
    } else {
      query = query.eq("technology_park_id", parkId);
    }
  }

  if (status === "active") query = query.eq("is_active", true);
  if (status === "disabled") query = query.eq("is_active", false);

  const { data, error, count } = await query.range(from, to);
  if (error) return NextResponse.json({ error: "LOAD_FAILED", detail: error.message }, { status: 500 });

  const meters = data ?? [];
  const buildingIds = Array.from(new Set(meters.map((m) => m.building_id)));
  const floorIds = Array.from(new Set(meters.map((m) => m.floor_id).filter((id): id is string => !!id)));

  const [{ data: buildingRows }, { data: floorRows }] = await Promise.all([
    buildingIds.length ? supabase.from("buildings").select("id, name_en").in("id", buildingIds) : Promise.resolve({ data: [] }),
    floorIds.length ? supabase.from("floors").select("id, name_en").in("id", floorIds) : Promise.resolve({ data: [] }),
  ]);
  const buildingNameById = new Map((buildingRows ?? []).map((b) => [b.id, b.name_en]));
  const floorNameById = new Map((floorRows ?? []).map((f) => [f.id, f.name_en]));

  const metersWithNames = meters.map((m) => ({
    ...m,
    buildings: { name_en: buildingNameById.get(m.building_id) ?? "—" },
    floors: m.floor_id ? { name_en: floorNameById.get(m.floor_id) ?? "—" } : null,
  }));

  return NextResponse.json({ meters: metersWithNames, total: count ?? 0, page, pageSize });
}

export async function POST(request: NextRequest) {
  const guard = await requireRole(["admin"]);
  if (guard instanceof NextResponse) return guard;
  const admin = guard;

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });

  if (!isMeterCategory(body.category)) return NextResponse.json({ error: "INVALID_CATEGORY" }, { status: 400 });
  const category = body.category;

  const buildingId = typeof body.buildingId === "string" ? body.buildingId : "";
  const floorId = typeof body.floorId === "string" && body.floorId ? body.floorId : null;
  const roomCode = typeof body.roomCode === "string" && body.roomCode.trim() ? body.roomCode.trim() : null;
  const labelEn = (body.labelEn ?? "").trim();
  const meterCode = (body.meterCode ?? "").trim().toUpperCase();
  const readingFrequency = body.readingFrequency === "MONTHLY" ? "MONTHLY" : "DAILY";
  const monthlyReadingDay = readingFrequency === "MONTHLY" ? Number(body.monthlyReadingDay) || 1 : null;
  const sortOrder = Number.isFinite(Number(body.sortOrder)) ? Number(body.sortOrder) : 0;
  const technologyParkId = typeof body.technologyParkId === "string" && body.technologyParkId ? body.technologyParkId : null;

  if (!buildingId) return NextResponse.json({ error: "MISSING_BUILDING" }, { status: 400 });
  if (!labelEn) return NextResponse.json({ error: "MISSING_LABEL" }, { status: 400 });
  if (!meterCode) return NextResponse.json({ error: "MISSING_METER_CODE" }, { status: 400 });

  const supabase = createAdminClient();
  const insertRow: Database["public"]["Tables"]["meters"]["Insert"] = {
    category,
    building_id: buildingId,
    floor_id: floorId,
    room_code: roomCode,
    label_en: labelEn,
    meter_code: meterCode,
    reading_frequency: readingFrequency,
    monthly_reading_day: monthlyReadingDay,
    sort_order: sortOrder,
    technology_park_id: technologyParkId,
  };

  const { data, error } = await supabase.from("meters").insert(insertRow).select().single();

  if (error) {
    if (error.code === "23505") return NextResponse.json({ error: "METER_CODE_TAKEN" }, { status: 409 });
    return NextResponse.json({ error: "INSERT_FAILED", detail: error.message }, { status: 500 });
  }

  await logAudit(supabase, { actorId: admin.id, action: "meter_created", tableName: "meters", recordId: data.id, newValue: data });
  return NextResponse.json({ meter: data }, { status: 201 });
}
