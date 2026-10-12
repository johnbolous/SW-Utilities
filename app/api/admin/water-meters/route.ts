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
  const status = request.nextUrl.searchParams.get("status") ?? "";
  const { page, pageSize, from, to } = parsePagination(request, 50);

  const supabase = createAdminClient();

  let query = supabase
    .from("water_meters")
    .select("*", { count: "exact" })
    .order("label_en");

  if (q) query = query.or(`label_en.ilike.%${q}%,meter_code.ilike.%${q}%`);
  if (parkId) query = query.eq("technology_park_id", parkId);
  if (status === "active") query = query.eq("is_active", true);
  if (status === "disabled") query = query.eq("is_active", false);

  const { data, error, count } = await query.range(from, to);
  
  if (error) {
    return NextResponse.json({ waterMeters: [], total: 0, page, pageSize, detail: error.message });
  }

  const waterMeters = data ?? [];
  const parkIds = Array.from(new Set(waterMeters.map((wm: any) => wm.technology_park_id).filter(Boolean)));

  let parkNameById = new Map<string, string>();
  if (parkIds.length > 0) {
    const { data: parkRows } = await supabase.from("technology_parks").select("id, name").in("id", parkIds);
    if (parkRows) {
      parkNameById = new Map(parkRows.map((p: any) => [p.id, p.name]));
    }
  }

  const waterMetersWithParks = waterMeters.map((wm: any) => ({
    ...wm,
    technology_parks: wm.technology_park_id ? { name: parkNameById.get(wm.technology_park_id) ?? "—" } : null,
  }));

  return NextResponse.json({ waterMeters: waterMetersWithParks, total: count ?? 0, page, pageSize });
}

export async function POST(request: NextRequest) {
  const guard = await requireRole(["admin"]);
  if (guard instanceof NextResponse) return guard;
  const admin = guard;

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });

  const technologyParkId = typeof body.technologyParkId === "string" ? body.technologyParkId : "";
  const type = typeof body.type === "string" && body.type.trim() ? body.type.trim() : "Drinking water";
  const labelEn = (body.labelEn ?? "").trim();
  const meterCode = (body.meterCode ?? "").trim().toUpperCase();
  const readingFrequency = body.readingFrequency === "MONTHLY" ? "MONTHLY" : "DAILY";
  const monthlyReadingDay = readingFrequency === "MONTHLY" ? Number(body.monthlyReadingDay) || 1 : null;

  if (!technologyParkId) return NextResponse.json({ error: "MISSING_TECHNOLOGY_PARK" }, { status: 400 });
  if (!labelEn) return NextResponse.json({ error: "MISSING_LABEL" }, { status: 400 });
  if (!meterCode) return NextResponse.json({ error: "MISSING_METER_CODE" }, { status: 400 });

  const supabase = createAdminClient();
  const insertRow: Database["public"]["Tables"]["water_meters"]["Insert"] = {
    technology_park_id: technologyParkId,
    type,
    label_en: labelEn,
    meter_code: meterCode,
    reading_frequency: readingFrequency,
    monthly_reading_day: monthlyReadingDay,
  };

  const { data, error } = await supabase.from("water_meters").insert(insertRow).select().single();

  if (error) {
    if (error.code === "23505") return NextResponse.json({ error: "METER_CODE_TAKEN" }, { status: 409 });
    return NextResponse.json({ error: "INSERT_FAILED", detail: error.message }, { status: 500 });
  }

  await logAudit(supabase, { actorId: admin.id, action: "water_meter_created", tableName: "water_meters", recordId: data.id, newValue: data });
  return NextResponse.json({ waterMeter: data }, { status: 201 });
}