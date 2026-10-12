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
  const status = request.nextUrl.searchParams.get("status") ?? "";
  const { page, pageSize, from, to } = parsePagination(request, 50);

  const supabase = createAdminClient();
  let query = supabase.from("solar_inverters").select("*", { count: "exact" }).order("inverter_no");
  if (q) query = query.or(`label_en.ilike.%${q}%,meter_code.ilike.%${q}%`);
  if (buildingId) query = query.eq("building_id", buildingId);
  if (status === "active") query = query.eq("is_active", true);
  if (status === "disabled") query = query.eq("is_active", false);

  const { data, error, count } = await query.range(from, to);
  if (error) return NextResponse.json({ error: "LOAD_FAILED", detail: error.message }, { status: 500 });

  const inverters = data ?? [];
  const buildingIds = Array.from(new Set(inverters.map((i) => i.building_id)));
  const { data: buildingRows } = buildingIds.length
    ? await supabase.from("buildings").select("id, name_en").in("id", buildingIds)
    : { data: [] };
  const nameById = new Map((buildingRows ?? []).map((b) => [b.id, b.name_en]));

  const invertersWithBuilding = inverters.map((i) => ({ ...i, buildings: { name_en: nameById.get(i.building_id) ?? "—" } }));

  return NextResponse.json({ solarInverters: invertersWithBuilding, total: count ?? 0, page, pageSize });
}

export async function POST(request: NextRequest) {
  const guard = await requireRole(["admin"]);
  if (guard instanceof NextResponse) return guard;
  const admin = guard;

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });

  const buildingId = typeof body.buildingId === "string" ? body.buildingId : "";
  const inverterNo = Number(body.inverterNo);
  const labelEn = (body.labelEn ?? "").trim();
  const meterCode = (body.meterCode ?? "").trim().toUpperCase();

  if (!buildingId) return NextResponse.json({ error: "MISSING_BUILDING" }, { status: 400 });
  if (!Number.isFinite(inverterNo) || inverterNo < 1) return NextResponse.json({ error: "INVALID_INVERTER_NO" }, { status: 400 });
  if (!labelEn) return NextResponse.json({ error: "MISSING_LABEL" }, { status: 400 });
  if (!meterCode) return NextResponse.json({ error: "MISSING_METER_CODE" }, { status: 400 });

  const supabase = createAdminClient();
  const insertRow: Database["public"]["Tables"]["solar_inverters"]["Insert"] = {
    building_id: buildingId,
    inverter_no: inverterNo,
    label_en: labelEn,
    meter_code: meterCode,
  };
  const { data, error } = await supabase.from("solar_inverters").insert(insertRow).select().single();

  if (error) {
    if (error.code === "23505") return NextResponse.json({ error: "DUPLICATE_INVERTER" }, { status: 409 });
    return NextResponse.json({ error: "INSERT_FAILED", detail: error.message }, { status: 500 });
  }

  await logAudit(supabase, { actorId: admin.id, action: "solar_inverter_created", tableName: "solar_inverters", recordId: data.id, newValue: data });
  return NextResponse.json({ solarInverter: data }, { status: 201 });
}
