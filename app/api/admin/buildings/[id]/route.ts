import { NextResponse, type NextRequest } from "next/server";
import { requireRole } from "@/lib/auth/requireRole";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/admin/audit";
import type { Database } from "@/types/database";

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requireRole(["admin"]);
  if (guard instanceof NextResponse) return guard;
  const admin = guard;

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });

  const supabase = createAdminClient();
  const { data: before } = await supabase.from("buildings").select("*").eq("id", params.id).maybeSingle();
  if (!before) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  const patch: Database["public"]["Tables"]["buildings"]["Update"] = {};
  if (typeof body.nameEn === "string" && body.nameEn.trim()) patch.name_en = body.nameEn.trim();
  if (typeof body.nameAr === "string") patch.name_ar = body.nameAr.trim() || null;
  if (body.sortOrder !== undefined && Number.isFinite(Number(body.sortOrder))) patch.sort_order = Number(body.sortOrder);
  if (typeof body.hasMeters === "boolean") patch.has_meters = body.hasMeters;
  if (typeof body.isActive === "boolean") patch.is_active = body.isActive;
  if (typeof body.parkId === "string" && body.parkId) patch.technology_park_id = body.parkId;

  if (Object.keys(patch).length === 0) return NextResponse.json({ error: "NOTHING_TO_UPDATE" }, { status: 400 });

  const { data: after, error } = await supabase.from("buildings").update(patch).eq("id", params.id).select().single();
  if (error) return NextResponse.json({ error: "UPDATE_FAILED", detail: error.message }, { status: 500 });

  await logAudit(supabase, {
    actorId: admin.id,
    action: "building_updated",
    tableName: "buildings",
    recordId: params.id,
    oldValue: before,
    newValue: after,
  });

  return NextResponse.json({ building: after });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const guard = await requireRole(["admin"]);
  if (guard instanceof NextResponse) return guard;

  const supabase = createAdminClient();

  const buildingId = params.id;


  // 1- حذف electric readings + photos + alerts الخاصة بالعدادات
  const { data: meters } = await supabase
    .from("meters")
    .select("id")
    .eq("building_id", buildingId);

  const meterIds = meters?.map(m => m.id) || [];

  if (meterIds.length > 0) {

    await supabase
      .from("electric_readings")
      .delete()
      .in("meter_id", meterIds);

    await supabase
      .from("photos")
      .delete()
      .in("meter_id", meterIds);

    await supabase
      .from("alerts")
      .delete()
      .in("meter_id", meterIds);
  }


  // 2- حذف العدادات
  await supabase
    .from("meters")
    .delete()
    .eq("building_id", buildingId);


  // 3- حذف الغرف
  await supabase
    .from("rooms")
    .delete()
    .eq("building_id", buildingId);


  // 4- حذف الأدوار
  await supabase
    .from("floors")
    .delete()
    .eq("building_id", buildingId);


  // 5- حذف عدادات المياه وقراءات المياه
  const { data: waterMeters } = await supabase
    .from("water_meters")
    .select("id")
    .eq("building_id", buildingId);

  const waterIds = waterMeters?.map(w => w.id) || [];

  if (waterIds.length > 0) {
    await supabase
      .from("water_readings")
      .delete()
      .in("water_meter_id", waterIds);

    await supabase
      .from("photos")
      .delete()
      .in("water_meter_id", waterIds);
  }

  await supabase
    .from("water_meters")
    .delete()
    .eq("building_id", buildingId);


  // 6- حذف الأكشاك
  const { data: kiosks } = await supabase
    .from("kiosks")
    .select("id")
    .eq("building_id", buildingId);

  const kioskIds = kiosks?.map(k => k.id) || [];

  if (kioskIds.length > 0) {
    await supabase
      .from("kiosk_readings")
      .delete()
      .in("kiosk_id", kioskIds);
  }

  await supabase
    .from("kiosks")
    .delete()
    .eq("building_id", buildingId);


  // 7- حذف الانفرترات والطاقة الشمسية
  const { data: inverters } = await supabase
    .from("solar_inverters")
    .select("id")
    .eq("building_id", buildingId);

  const inverterIds = inverters?.map(i => i.id) || [];

  if (inverterIds.length > 0) {
    await supabase
      .from("solar_production")
      .delete()
      .in("inverter_id", inverterIds);

    await supabase
      .from("photos")
      .delete()
      .in("inverter_id", inverterIds);
  }

  await supabase
    .from("solar_inverters")
    .delete()
    .eq("building_id", buildingId);


  // 8- أخيراً حذف المبنى
  const { error } = await supabase
    .from("buildings")
    .delete()
    .eq("id", buildingId);


  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }


  return NextResponse.json({
    message: "Building and all related data deleted successfully"
  });
}


