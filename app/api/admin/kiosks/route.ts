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
  const status = request.nextUrl.searchParams.get("status") ?? "";
  const { page, pageSize, from, to } = parsePagination(request, 50);

  const supabase = createAdminClient();
  let query = supabase.from("kiosks").select("*", { count: "exact" }).order("sort_order");
  if (q) query = query.or(`name.ilike.%${q}%,meter_code.ilike.%${q}%`);
  if (status === "active") query = query.eq("is_active", true);
  if (status === "disabled") query = query.eq("is_active", false);

  const { data, error, count } = await query.range(from, to);
  if (error) return NextResponse.json({ error: "LOAD_FAILED", detail: error.message }, { status: 500 });

  const kiosks = data ?? [];
  
  // جلب أسماء المباني
  const buildingIds = Array.from(new Set(kiosks.map((k) => k.building_id).filter((id): id is string => !!id)));
  const { data: buildingRows } = buildingIds.length
    ? await supabase.from("buildings").select("id, name_en").in("id", buildingIds)
    : { data: [] };
  const nameById = new Map((buildingRows ?? []).map((b) => [b.id, b.name_en]));

  // جلب أسماء المناطق (Parks)
  const parkIds = Array.from(new Set(kiosks.map((k) => (k as any).park_id).filter((id): id is string => !!id)));
  const { data: parkRows } = parkIds.length
    ? await supabase.from("parks").select("id, name").in("id", parkIds)
    : { data: [] };
  const parkNameById = new Map((parkRows ?? []).map((p) => [p.id, p.name]));

  const kiosksWithDetails = kiosks.map((k) => ({
    ...k,
    buildings: k.building_id ? { name_en: nameById.get(k.building_id) ?? "—" } : null,
    parks: (k as any).park_id ? { name: parkNameById.get((k as any).park_id) ?? "—" } : null,
  }));

  return NextResponse.json({ kiosks: kiosksWithDetails, total: count ?? 0, page, pageSize });
}

export async function POST(request: NextRequest) {
  const guard = await requireRole(["admin"]);
  if (guard instanceof NextResponse) return guard;
  const admin = guard;

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });

  const name = (body.name ?? "").trim();
  const meterCode = (body.meterCode ?? "").trim().toUpperCase();
  const sortOrder = Number.isFinite(Number(body.sortOrder)) ? Number(body.sortOrder) : 0;
  const buildingId = typeof body.buildingId === "string" && body.buildingId ? body.buildingId : null;
  const parkId = typeof body.parkId === "string" && body.parkId ? body.parkId : null; // استقبال الـ parkId

  if (!name) return NextResponse.json({ error: "MISSING_NAME" }, { status: 400 });
  if (!meterCode) return NextResponse.json({ error: "MISSING_METER_CODE" }, { status: 400 });

  const supabase = createAdminClient();
  const insertRow: Database["public"]["Tables"]["kiosks"]["Insert"] = {
    name,
    meter_code: meterCode,
    sort_order: sortOrder,
    building_id: buildingId,
    park_id: parkId, // حفظ الـ park_id في قاعدة البيانات
  };
  const { data, error } = await supabase.from("kiosks").insert(insertRow).select().single();

  if (error) {
    if (error.code === "23505") return NextResponse.json({ error: "METER_CODE_TAKEN" }, { status: 409 });
    return NextResponse.json({ error: "INSERT_FAILED", detail: error.message }, { status: 500 });
  }

  await logAudit(supabase, { actorId: admin.id, action: "kiosk_created", tableName: "kiosks", recordId: data.id, newValue: data });
  return NextResponse.json({ kiosk: data }, { status: 201 });
}
