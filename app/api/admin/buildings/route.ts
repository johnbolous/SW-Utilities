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
  const parkId = request.nextUrl.searchParams.get("parkId") ?? "";
  const { page, pageSize, from, to } = parsePagination(request, 50);

  const supabase = createAdminClient();
  let query = supabase.from("buildings").select("*", { count: "exact" }).order("sort_order");
  if (q) query = query.or(`name_en.ilike.%${q}%,code.ilike.%${q}%`);
  if (parkId) query = query.eq("technology_park_id", parkId);

  const { data, error, count } = await query.range(from, to);
  if (error) return NextResponse.json({ error: "LOAD_FAILED", detail: error.message }, { status: 500 });

  const buildings = data ?? [];
  const parkIds = Array.from(new Set(buildings.map((b) => b.technology_park_id).filter((id): id is string => !!id)));
  const { data: parkRows } = parkIds.length
    ? await supabase.from("technology_parks").select("id, name").in("id", parkIds)
    : { data: [] };
  const nameById = new Map((parkRows ?? []).map((p) => [p.id, p.name]));

  const buildingsWithPark = buildings.map((b) => ({
    ...b,
    technology_parks: b.technology_park_id ? { name: nameById.get(b.technology_park_id) ?? "—" } : null,
  }));

  return NextResponse.json({ buildings: buildingsWithPark, total: count ?? 0, page, pageSize });
}

export async function POST(request: NextRequest) {
  const guard = await requireRole(["admin"]);
  if (guard instanceof NextResponse) return guard;
  const admin = guard;

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });

  const code = (body.code ?? "").trim().toLowerCase().replace(/\s+/g, "_");
  const nameEn = (body.nameEn ?? "").trim();
  const nameAr = (body.nameAr ?? "").trim() || null;
  const sortOrder = Number.isFinite(Number(body.sortOrder)) ? Number(body.sortOrder) : 0;
  const hasMeters = body.hasMeters !== false;
  const parkId = typeof body.parkId === "string" && body.parkId ? body.parkId : null;

  if (!code) return NextResponse.json({ error: "MISSING_CODE" }, { status: 400 });
  if (!nameEn) return NextResponse.json({ error: "MISSING_NAME" }, { status: 400 });
  if (!parkId) return NextResponse.json({ error: "MISSING_PARK" }, { status: 400 });

  const supabase = createAdminClient();
  const insertRow: Database["public"]["Tables"]["buildings"]["Insert"] = {
    code,
    name_en: nameEn,
    name_ar: nameAr,
    sort_order: sortOrder,
    has_meters: hasMeters,
    technology_park_id: parkId,
  };
  const { data, error } = await supabase.from("buildings").insert(insertRow).select().single();

  if (error) {
    if (error.code === "23505") return NextResponse.json({ error: "CODE_TAKEN" }, { status: 409 });
    return NextResponse.json({ error: "INSERT_FAILED", detail: error.message }, { status: 500 });
  }

  await logAudit(supabase, { actorId: admin.id, action: "building_created", tableName: "buildings", recordId: data.id, newValue: data });
  return NextResponse.json({ building: data }, { status: 201 });
}
