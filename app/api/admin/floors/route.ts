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
  const buildingId = request.nextUrl.searchParams.get("buildingId") ?? "";
  const { page, pageSize, from, to } = parsePagination(request, 50);

  const supabase = createAdminClient();

  let buildingIds: string[] | null = null;
  if (parkId) {
    const { data: parkBuildings, error: bErr } = await supabase
      .from("buildings")
      .select("id")
      .eq("technology_park_id", parkId);

    if (bErr) return NextResponse.json({ error: "LOAD_FAILED", detail: bErr.message }, { status: 500 });

    buildingIds = (parkBuildings ?? []).map((b) => b.id);
    if (buildingIds.length === 0) {
      return NextResponse.json({ floors: [], total: 0, page, pageSize });
    }
  }

  let query = supabase.from("floors").select("*, buildings(name_en)", { count: "exact" }).order("sort_order");

  if (q) query = query.or(`name_en.ilike.%${q}%,code.ilike.%${q}%`);
  if (buildingIds !== null) query = query.in("building_id", buildingIds);
  if (buildingId) query = query.eq("building_id", buildingId);

  const { data, error, count } = await query.range(from, to);
  if (error) return NextResponse.json({ error: "LOAD_FAILED", detail: error.message }, { status: 500 });

  return NextResponse.json({ floors: data ?? [], total: count ?? 0, page, pageSize });
}

export async function POST(request: NextRequest) {
  const guard = await requireRole(["admin"]);
  if (guard instanceof NextResponse) return guard;
  const admin = guard;

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });

  const buildingId = (body.buildingId ?? "").trim();
  const code = (body.code ?? "").trim().toLowerCase().replace(/\s+/g, "_");
  const nameEn = (body.nameEn ?? "").trim();
  const nameAr = (body.nameAr ?? "").trim() || null;
  const sortOrder = Number.isFinite(Number(body.sortOrder)) ? Number(body.sortOrder) : 0;

  if (!buildingId) return NextResponse.json({ error: "MISSING_BUILDING" }, { status: 400 });
  if (!code) return NextResponse.json({ error: "MISSING_CODE" }, { status: 400 });
  if (!nameEn) return NextResponse.json({ error: "MISSING_NAME" }, { status: 400 });

  const supabase = createAdminClient();
  const insertRow: Database["public"]["Tables"]["floors"]["Insert"] = {
    building_id: buildingId,
    code,
    name_en: nameEn,
    name_ar: nameAr,
    sort_order: sortOrder,
  };
  const { data, error } = await supabase.from("floors").insert(insertRow).select().single();

  if (error) {
    if (error.code === "23505") return NextResponse.json({ error: "CODE_TAKEN_FOR_BUILDING" }, { status: 409 });
    return NextResponse.json({ error: "INSERT_FAILED", detail: error.message }, { status: 500 });
  }

  await logAudit(supabase, { actorId: admin.id, action: "floor_created", tableName: "floors", recordId: data.id, newValue: data });
  return NextResponse.json({ floor: data }, { status: 201 });
}