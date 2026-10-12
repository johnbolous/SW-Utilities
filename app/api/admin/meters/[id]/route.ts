import { NextResponse, type NextRequest } from "next/server";
import { requireRole } from "@/lib/auth/requireRole";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/admin/audit";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireRole(["admin"]);
  if (guard instanceof NextResponse) return guard;
  const admin = guard;
  const { id } = await params;

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });

  const buildingId = typeof body.buildingId === "string" ? body.buildingId : undefined;
  const floorId = typeof body.floorId === "string" ? body.floorId : undefined;
  const roomCode = typeof body.roomCode === "string" ? body.roomCode.trim() : undefined;
  const labelEn = typeof body.labelEn === "string" ? body.labelEn.trim() : undefined;
  const readingFrequency = body.readingFrequency;
  
  // التعديل هنا: منع تحويل الـ null إلى الرقم 0 لكي يتوافق مع قاعدة البيانات
  const monthlyReadingDay = 
    body.monthlyReadingDay !== undefined 
      ? (body.monthlyReadingDay === null ? null : Number(body.monthlyReadingDay)) 
      : undefined;

  const sortOrder = body.sortOrder !== undefined ? Number(body.sortOrder) : undefined;

  const updateData: Record<string, any> = {};
  if (buildingId !== undefined) updateData.building_id = buildingId;
  if (floorId !== undefined) updateData.floor_id = floorId || null;
  if (roomCode !== undefined) updateData.room_code = roomCode || null;
  if (labelEn !== undefined) updateData.label_en = labelEn;
  if (readingFrequency !== undefined) updateData.reading_frequency = readingFrequency;
  if (monthlyReadingDay !== undefined) updateData.monthly_reading_day = monthlyReadingDay;
  if (sortOrder !== undefined) updateData.sort_order = sortOrder;

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("meters")
    .update(updateData)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: "UPDATE_FAILED", detail: error.message }, { status: 500 });
  }

  await logAudit(supabase, { actorId: admin.id, action: "meter_updated", tableName: "meters", recordId: id, newValue: data });
  return NextResponse.json({ meter: data });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireRole(["admin"]);
  if (guard instanceof NextResponse) return guard;
  const admin = guard;
  const { id } = await params;

  const supabase = createAdminClient();
  const { error } = await supabase.from("meters").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: "DELETE_FAILED", detail: error.message }, { status: 500 });
  }

  await logAudit(supabase, { actorId: admin.id, action: "meter_deleted", tableName: "meters", recordId: id });
  return NextResponse.json({ success: true });
}