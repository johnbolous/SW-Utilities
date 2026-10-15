import { NextResponse, type NextRequest } from "next/server";
import { requireRole } from "@/lib/auth/requireRole";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/admin/audit";
import { isReadingFrequency } from "@/lib/utils/enumGuards";

export async function GET(request: NextRequest) {
  const guard = await requireRole(["admin", "engineer"]);
  if (guard instanceof NextResponse) return guard;

  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get("page") || "1", 10);
  const limit = parseInt(searchParams.get("limit") || "10", 10);
  const offset = (page - 1) * limit;

  const q = searchParams.get("q") || "";
  const parkId = searchParams.get("parkId") || "";
  const buildingId = searchParams.get("buildingId") || "";
  const status = searchParams.get("status") || "";

  const supabase = createAdminClient();
  
  // تعريف query كـ any بالكامل لمنع أي تدقيق صارم من TypeScript
  let query: any = supabase.from("water_meters").select("*, buildings(id, name, technology_park_id)", { count: "exact" });

  if (q) query = query.or(`label_en.ilike.%${q}%,meter_code.ilike.%${q}%`);
  
  if (parkId) {
    const { data: parkBuildings } = await supabase
      .from("buildings")
      .select("id")
      .eq("technology_park_id", parkId);
    
    const buildingIds = ((parkBuildings as any[]) ?? []).map((b) => b.id).filter(Boolean);
    
    if (buildingIds.length > 0) {
      query = query.in("building_id", buildingIds);
    } else {
      query = query.eq("building_id", "00000000-0000-0000-0000-000000000000");
    }
  }

  if (buildingId) query = query.eq("building_id", buildingId);
  if (status === "active") query = query.eq("is_active", true);
  if (status === "disabled") query = query.eq("is_active", false);

  const { data, count, error } = await query
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    return NextResponse.json({ error: "FETCH_FAILED", detail: error.message }, { status: 500 });
  }

  return NextResponse.json({
    waterMeters: data || [],
    pagination: {
      page,
      limit,
      total: count || 0,
      totalPages: Math.ceil((count || 0) / limit),
    },
  });
}

export async function POST(request: NextRequest) {
  const guard = await requireRole(["admin"]);
  if (guard instanceof NextResponse) return guard;
  const admin = guard;

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });

  const buildingId = typeof body.buildingId === "string" ? body.buildingId : "";
  const meterCode = typeof body.meterCode === "string" ? body.meterCode.trim() : "";
  const labelEn = typeof body.labelEn === "string" ? body.labelEn.trim() : "";
  const type = typeof body.type === "string" ? body.type.trim() : "DRINKING";
  const readingFrequency = isReadingFrequency(body.readingFrequency) ? body.readingFrequency : "MONTHLY";
  const monthlyReadingDay = readingFrequency === "MONTHLY" ? Number(body.monthlyReadingDay) || 1 : null;

  if (!buildingId || !meterCode) {
    return NextResponse.json({ error: "MISSING_REQUIRED_FIELDS" }, { status: 400 });
  }

  const supabase = createAdminClient();
  
  const insertData: Record<string, any> = {
    building_id: buildingId,
    meter_code: meterCode,
    label_en: labelEn || null,
    type,
    reading_frequency: readingFrequency,
    monthly_reading_day: monthlyReadingDay,
    is_active: true,
  };

  const insertResult = await (supabase.from("water_meters") as any)
    .insert(insertData)
    .select()
    .single();

  if (insertResult.error) {
    return NextResponse.json({ error: "CREATE_FAILED", detail: insertResult.error.message }, { status: 500 });
  }

  const createdData = (insertResult.data as any) || {};

  await logAudit(supabase, {
    actorId: admin.id,
    action: "water_meter_created",
    tableName: "water_meters",
    recordId: createdData.id || "00000000-0000-0000-0000-000000000000",
    newValue: createdData,
  });

  return NextResponse.json({ waterMeter: createdData }, { status: 201 });
}
